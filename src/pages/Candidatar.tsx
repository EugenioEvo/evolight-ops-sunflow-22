import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { especialidadesOptions, certificacoesOptions, experienciaOptions } from '@/features/providers';

const candidaturaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(120),
  email: z.string().trim().email('E-mail inválido').max(255),
  telefone: z.string().trim().min(10, 'Telefone inválido').max(20),
  cpf: z.string().trim().optional().or(z.literal('')),
  cidade: z.string().trim().max(100).optional().or(z.literal('')),
  estado: z.string().trim().max(2).optional().or(z.literal('')),
  categoria: z.enum(['tecnico', 'supervisao'], { required_error: 'Selecione uma área' }),
  experiencia: z.string().optional(),
  observacoes: z.string().max(1000).optional().or(z.literal('')),
});

const Candidatar = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', cpf: '',
    cidade: '', estado: '', categoria: '', experiencia: '', observacoes: '',
  });
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [certificacoes, setCertificacoes] = useState<string[]>([]);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const toggle = (arr: string[], setter: (a: string[]) => void, v: string) =>
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = candidaturaSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('prestadores').insert({
        nome: parsed.data.nome,
        email: parsed.data.email.toLowerCase(),
        telefone: parsed.data.telefone,
        cpf: parsed.data.cpf || null,
        cidade: parsed.data.cidade || null,
        estado: parsed.data.estado || null,
        categoria: parsed.data.categoria,
        experiencia: parsed.data.experiencia || null,
        especialidades,
        certificacoes,
        observacoes_candidato: parsed.data.observacoes || null,
        status_candidatura: 'pendente',
        ativo: false,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        toast.error('Já existe uma candidatura com este e-mail.');
      } else {
        toast.error(err.message || 'Erro ao enviar candidatura');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto p-4 rounded-full bg-success/10 w-fit mb-2">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <CardTitle>Candidatura enviada!</CardTitle>
            <CardDescription>
              Recebemos sua inscrição. A Evolight irá avaliar seu perfil e, se aprovado,
              você receberá um e-mail com instruções de acesso ao sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} variant="outline" className="w-full">
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/auth')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="h-8 w-8 text-primary" />
              <span className="text-3xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                SunFlow
              </span>
            </div>
            <CardTitle>Candidate-se a Prestador de Serviço</CardTitle>
            <CardDescription>
              Preencha seus dados profissionais. Após avaliação da Evolight, você receberá
              um convite por e-mail caso seu perfil seja aprovado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={form.nome} onChange={e => update('nome', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Input value={form.telefone} onChange={e => update('telefone', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={e => update('cpf', e.target.value)} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={e => update('cidade', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Input value={form.estado} onChange={e => update('estado', e.target.value.toUpperCase())} maxLength={2} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Área de atuação *</Label>
                  <Select value={form.categoria} onValueChange={v => update('categoria', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tecnico">Técnico de Campo</SelectItem>
                      <SelectItem value="supervisao">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tempo de experiência</Label>
                  <Select value={form.experiencia} onValueChange={v => update('experiencia', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {experienciaOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Especialidades</Label>
                <div className="flex flex-wrap gap-2">
                  {especialidadesOptions.map(esp => (
                    <Badge
                      key={esp}
                      variant={especialidades.includes(esp) ? 'default' : 'outline'}
                      onClick={() => toggle(especialidades, setEspecialidades, esp)}
                      className="cursor-pointer min-h-[44px] px-3 flex items-center"
                    >
                      {esp}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Certificações</Label>
                <div className="flex flex-wrap gap-2">
                  {certificacoesOptions.map(cert => (
                    <Badge
                      key={cert}
                      variant={certificacoes.includes(cert) ? 'default' : 'outline'}
                      onClick={() => toggle(certificacoes, setCertificacoes, cert)}
                      className="cursor-pointer min-h-[44px] px-3 flex items-center"
                    >
                      {cert}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações / breve currículo</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={e => update('observacoes', e.target.value)}
                  rows={4}
                  placeholder="Conte um pouco sobre sua experiência, principais projetos e disponibilidade."
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar candidatura'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Candidatar;
