import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ingresar — CoverTurnos" },
      { name: "description", content: "Inicia sesión o regístrate para ver turnos disponibles." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bienvenido");
    navigate({ to: "/app", replace: true });
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/app" : undefined,
        data: { nombre_completo: nombre, telefono },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. Ya puedes ingresar.");
    navigate({ to: "/app", replace: true });
  };

  const signInGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setLoading(false);
    if (result.error) return toast.error(String(result.error.message ?? result.error));
    if (result.redirected) return;
    navigate({ to: "/app", replace: true });
  };

  // suppress unused location warning in some configs
  void location;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">C</div>
          <h1 className="text-2xl font-semibold tracking-tight">CoverTurnos</h1>
          <p className="text-sm text-muted-foreground">Cobertura de turnos para tus tiendas</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Acceder</CardTitle>
            <CardDescription>Ingresa con tu correo o con Google.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarme</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" disabled={loading || !email || !password} onClick={signIn}>
                  Entrar
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tel">Teléfono</Label>
                  <Input id="tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Correo</Label>
                  <Input id="email2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Contraseña</Label>
                  <Input id="password2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button className="w-full" disabled={loading || !email || !password} onClick={signUp}>
                  Crear cuenta
                </Button>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" disabled={loading} onClick={signInGoogle}>
              Continuar con Google
            </Button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al ingresar aceptas las normas internas de la operación.
        </p>
      </div>
    </div>
  );
}
