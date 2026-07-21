// Cron diário: envia alertas (in-app + email) de certificações HSE
// nas janelas 30d, 7d e 0d antes do vencimento. Deduplicado por
// hse_certificacao_alertas (unique certificacao_id + janela_dias).
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SENDER = 'SunFlow <oem@grupoevolight.com.br>';

const WINDOWS = [30, 7, 0];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00Z').getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.floor((target - today.getTime()) / 86_400_000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    // Janela máxima: 30 dias no futuro + vencidas até 0 dias
    const upperLimit = new Date();
    upperLimit.setUTCDate(upperLimit.getUTCDate() + 31);
    const lowerLimit = new Date();
    lowerLimit.setUTCDate(lowerLimit.getUTCDate() - 1);

    const { data: certs, error } = await supabase
      .from('hse_certificacoes')
      .select(`
        id, data_vencimento, observacoes,
        profile_id, prestador_id,
        hse_certificacao_tipos!inner(nome),
        profiles(nome, email, user_id),
        prestadores(nome, email)
      `)
      .not('data_vencimento', 'is', null)
      .gte('data_vencimento', lowerLimit.toISOString().split('T')[0])
      .lte('data_vencimento', upperLimit.toISOString().split('T')[0]);

    if (error) throw error;

    // Admin/engenharia recipients (in-app + email)
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'engenharia']);
    const managerUserIds = Array.from(new Set((rolesData || []).map((r: any) => r.user_id)));

    const { data: managerProfiles } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('user_id', managerUserIds.length ? managerUserIds : ['00000000-0000-0000-0000-000000000000']);
    const managerEmails = Array.from(
      new Set((managerProfiles || []).map((p: any) => (p.email || '').trim().toLowerCase()).filter(Boolean)),
    );

    let enviados = 0;
    let ignorados = 0;

    for (const cert of certs || []) {
      const dias = daysUntil((cert as any).data_vencimento);
      const janela = WINDOWS.find((w) => dias === w);
      if (janela === undefined) {
        ignorados++;
        continue;
      }

      // Dedup: tenta inserir; se já existir (unique constraint), pula
      const { error: dedupErr } = await supabase
        .from('hse_certificacao_alertas')
        .insert({ certificacao_id: (cert as any).id, janela_dias: janela });
      if (dedupErr) {
        ignorados++;
        continue;
      }

      const nomeTipo = (cert as any).hse_certificacao_tipos?.nome ?? 'Certificação';
      const dono =
        (cert as any).profiles?.nome ||
        (cert as any).prestadores?.nome ||
        'Colaborador';
      const donoEmail =
        (cert as any).profiles?.email ||
        (cert as any).prestadores?.email ||
        null;
      const donoUserId = (cert as any).profiles?.user_id || null;

      const titulo =
        janela === 0
          ? `Certificação vencida: ${nomeTipo}`
          : `Certificação vence em ${janela} dia${janela === 1 ? '' : 's'}: ${nomeTipo}`;
      const mensagem =
        janela === 0
          ? `A certificação "${nomeTipo}" de ${dono} venceu em ${(cert as any).data_vencimento}.`
          : `A certificação "${nomeTipo}" de ${dono} vence em ${(cert as any).data_vencimento}.`;

      // In-app: dono
      if (donoUserId) {
        await supabase.from('notificacoes').insert({
          user_id: donoUserId,
          tipo: 'hse_certificacao_alerta',
          titulo,
          mensagem,
          link: '/usuarios',
        });
      }
      // In-app: gestores
      for (const uid of managerUserIds) {
        await supabase.from('notificacoes').insert({
          user_id: uid,
          tipo: 'hse_certificacao_alerta',
          titulo,
          mensagem,
          link: '/hse/catalogo-certificacoes',
        });
      }

      // Email
      if (resend) {
        const to = Array.from(
          new Set(
            [donoEmail, ...managerEmails]
              .map((e) => (e || '').trim().toLowerCase())
              .filter(Boolean),
          ),
        );
        if (to.length > 0) {
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
              <h2 style="color:#b45309">${titulo}</h2>
              <p>${mensagem}</p>
              <ul>
                <li><b>Colaborador:</b> ${dono}</li>
                <li><b>Certificação:</b> ${nomeTipo}</li>
                <li><b>Vencimento:</b> ${(cert as any).data_vencimento}</li>
              </ul>
              <p style="color:#666;font-size:12px">Este é um alerta automático do SunFlow HSE.</p>
            </div>
          `;
          try {
            await resend.emails.send({ from: SENDER, to, subject: titulo, html });
          } catch (e) {
            console.error('[hse-check-certificacoes] Falha ao enviar email:', e);
          }
        }
      }

      enviados++;
    }

    return new Response(
      JSON.stringify({ success: true, total_avaliadas: certs?.length ?? 0, enviados, ignorados }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[hse-check-certificacoes] erro:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
