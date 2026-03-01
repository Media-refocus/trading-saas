"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Building2,
  CreditCard,
  Activity,
  Loader2,
  CheckCircle2,
  Key,
} from "lucide-react";

export default function PerfilPage() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Obtener datos del usuario
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  // Mutations
  const updateProfile = trpc.auth.updateProfile.useMutation();
  const changePassword = trpc.auth.changePassword.useMutation();
  const utils = trpc.useUtils();

  // Cargar datos cuando el usuario esté disponible
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ name });
      utils.auth.me.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error guardando perfil:", error);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    try {
      await changePassword.mutateAsync({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 3000);
    } catch (error) {
      setPasswordError("La contraseña actual es incorrecta");
    }
  };

  // Formatear fecha
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Obtener iniciales para avatar
  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  // Obtener color del badge según el plan
  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "ENTERPRISE":
        return "default";
      case "PRO":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Obtener nombre del plan
  const getPlanName = (plan: string) => {
    switch (plan) {
      case "ENTERPRISE":
        return "VIP";
      case "PRO":
        return "Pro";
      case "BASIC":
        return "Trader";
      default:
        return "Trial";
    }
  };

  // Obtener icono de rol
  const getRoleIcon = (role: string) => {
    return role === "ADMIN" ? (
      <Shield className="h-4 w-4 text-yellow-500" />
    ) : (
      <User className="h-4 w-4 text-blue-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground mt-2 text-[13px] md:text-base">
          Gestiona tu información personal y cuenta
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="h-20 w-20 text-lg">
              <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
              <AvatarFallback className="bg-blue-600 text-white">
                {getInitials(user?.name, user?.email || "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{user?.name || "Sin nombre"}</h2>
                <Badge variant={getPlanBadgeVariant("")}>
                  {getPlanName("")}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  {getRoleIcon(user?.role || "USER")}
                  {user?.role === "ADMIN" ? "Administrador" : "Usuario"}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center gap-2 text-[13px] md:text-sm">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
              <p className="text-muted-foreground flex items-center gap-2 text-[13px] md:text-sm">
                <Calendar className="h-4 w-4" />
                Miembro desde {formatDate(user?.createdAt || new Date())}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Organization Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Building2 className="h-5 w-5" />
              Organización
            </CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Información de tu cuenta de trading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Nombre</span>
              <span className="font-medium text-[13px] md:text-sm">{user?.id || ""}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Plan</span>
              <Badge variant={getPlanBadgeVariant("")}>
                {getPlanName("")}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Creada</span>
              <span className="text-[13px] md:text-sm">{formatDate(new Date() || new Date())}</span>
            </div>
          </CardContent>
        </Card>

        {/* Activity Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Activity className="h-5 w-5" />
              Actividad
            </CardTitle>
            <CardDescription className="text-[13px] md:text-sm">
              Resumen de tu actividad en la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Cuentas de Trading</span>
              <span className="font-medium text-[13px] md:text-sm">{0}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Señales Recibidas</span>
              <span className="font-medium text-[13px] md:text-sm">{0}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[13px] md:text-sm">Operaciones</span>
              <span className="font-medium text-[13px] md:text-sm">{0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <User className="h-5 w-5" />
            Editar Perfil
          </CardTitle>
          <CardDescription className="text-[13px] md:text-sm">
            Actualiza tu información personal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-[13px] md:text-sm font-medium mb-2 block">
              Nombre
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={updateProfile.isPending}
              className="h-11"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-[13px] md:text-sm font-medium mb-2 block">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              disabled
              value={user?.email || ""}
              className="bg-muted h-11"
            />
            <p className="text-[13px] text-muted-foreground mt-1">
              El email no se puede cambiar
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending || name === user?.name}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
            {saved && (
              <span className="text-[13px] text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Guardado
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Key className="h-5 w-5" />
            Cambiar Contraseña
          </CardTitle>
          <CardDescription className="text-[13px] md:text-sm">
            Actualiza tu contraseña de acceso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currentPassword" className="text-[13px] md:text-sm font-medium mb-2 block">
              Contraseña Actual
            </Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Tu contraseña actual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={changePassword.isPending}
              className="h-11"
            />
          </div>
          <div>
            <Label htmlFor="newPassword" className="text-[13px] md:text-sm font-medium mb-2 block">
              Nueva Contraseña
            </Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Nueva contraseña (min. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={changePassword.isPending}
              className="h-11"
            />
          </div>
          {passwordError && (
            <p className="text-[13px] text-red-500">{passwordError}</p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button
              onClick={handleChangePassword}
              disabled={changePassword.isPending || !currentPassword || newPassword.length < 6}
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              {changePassword.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cambiando...
                </>
              ) : (
                "Cambiar Contraseña"
              )}
            </Button>
            {passwordChanged && (
              <span className="text-[13px] text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Contraseña actualizada
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
