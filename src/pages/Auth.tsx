import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Textarea } from '@/components/ui/textarea';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { z } from 'zod';
import { ForgotPasswordLink } from '@/components/ForgotPasswordLink';

const signupSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres'),
  password: z.string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(72, 'Senha deve ter no máximo 72 caracteres'),
  telefone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone deve ter 10 ou 11 dígitos')
    .optional()
    .or(z.literal('')),
  role: z.enum(['cliente', 'tecnico_campo', 'engenharia', 'supervisao']),
  empresa: z.string().max(200, 'Empresa deve ter no máximo 200 caracteres').optional(),
  cnpjCpf: z.string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos')
    .optional()
    .or(z.literal('')),
  endereco: z.string().max(500, 'Endereço deve ter no máximo 500 caracteres').optional(),
  cidade: z.string().max(100, 'Cidade deve ter no máximo 100 caracteres').optional(),
  estado: z.string().max(2, 'Estado deve ter 2 caracteres').optional(),
  cep: z.string()
    .regex(/^\d{8}$/, 'CEP deve ter 8 dígitos')
    .optional()
    .or(z.literal('')),
  registroProfissional: z.string().max(50, 'Registro deve ter no máximo 50 caracteres').optional(),
  especialidades: z.string().max(500, 'Especialidades devem ter no máximo 500 caracteres').optional(),
  regiaoAtuacao: z.string().max(200, 'Região deve ter no máximo 200 caracteres').optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const role = 'cliente'; // Self-registration always creates cliente accounts
  const [empresa, setEmpresa] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [registroProfissional, setRegistroProfissional] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [regiaoAtuacao, setRegiaoAtuacao] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta.",
      });
      
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const formData = {
        nome,
        email,
        password,
        telefone: telefone || '',
        role: 'cliente' as const,
        empresa,
        cnpjCpf: cnpjCpf || '',
        endereco,
        cidade,
        estado,
        cep: cep || '',
      };

      const validationResult = signupSchema.safeParse(formData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

      const { data, error } = await supabase.auth.signUp({
        email: validationResult.data.email,
        password: validationResult.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: validationResult.data.nome,
            telefone: validationResult.data.telefone || undefined,
            role: validationResult.data.role,
            empresa: validationResult.data.empresa,
            cnpj_cpf: validationResult.data.cnpjCpf || undefined,
            endereco: validationResult.data.endereco,
            cidade: validationResult.data.cidade,
            estado: validationResult.data.estado,
            cep: validationResult.data.cep || undefined,
            registro_profissional: validationResult.data.registroProfissional,
            especialidades: validationResult.data.especialidades?.split(',').map(s => s.trim()),
            regiao_atuacao: validationResult.data.regiaoAtuacao,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Fazendo login...",
        });

        // Login automático após signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Chamar edge function para criar perfil do usuário
        const { error: profileError } = await supabase.functions.invoke('create-user-profile');
        
        if (profileError) {
          console.error('Erro ao criar perfil:', profileError);
        }

        // Aguardar profile ser criado com polling (máximo 3 segundos)
        let attempts = 0;
        while (attempts < 6) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, user_roles(role)')
            .eq('user_id', data.user.id)
            .maybeSingle();
          
          if (profileData?.user_roles) {
            break;
          }
          
          await new Promise(r => setTimeout(r, 500));
          attempts++;
        }

        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso.",
        });

        navigate('/');
      }
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Zap className="h-8 w-8 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
              SunFlow
            </span>
          </div>
          <CardTitle>{isLogin ? 'Entrar' : 'Criar Conta'}</CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Entre com suas credenciais para acessar o sistema'
              : 'Preencha os dados para criar sua conta'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <ForgotPasswordLink />

            <div className="pt-4 border-t space-y-2 text-center text-sm">
              <p className="text-muted-foreground">
                <strong>Primeiro acesso?</strong> Use "Esqueci minha senha" com o e-mail cadastrado pela Evolight.
              </p>
              <p className="text-muted-foreground">
                Quer ser prestador?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/candidatar-se')}
                  className="text-primary underline-offset-4 hover:underline font-medium"
                >
                  Candidate-se aqui
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;