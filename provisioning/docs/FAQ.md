# FAQ - Trading Bot SaaS

## Preguntas Frecuentes

### El bot no se conecta al SaaS

**Posibles causas:**
1. API key incorrecta
2. SaaS no disponible
3. Problemas de red
4. Suscripción vencida

**Solución:**
- Verificar que el API key es correctos (debe empezar con `tb_`)
- Verificar conexión a internet
- Verificar que el SaaS está online (ping)
- Verificar que el archivo de configuración existe
- Verificar que el servicio está corriendo (running)

- Verificar logs en busca de errores

### MT5 no funciona / errores de conexión

1. Verificar que MT5 está abierto: `mt.initialize()`
2. Verificar credenciales (login, password, server)
3. Si usa VPS remoto, verifica firewall

### El bot no recibe señ del SaaS

1. Verificar conexión a internet
2. Verificar API key
3. Verificar que el servidor SaaS responde
4. Si todo OK, reiniciar

**Solución:**
1. Verificar API key: asegúrate de que la empez con `--api-key`
2. Verificar que MT5 está instalado corriendo (si no, instalarlo)
3. Verificar credenciales MT5 en `app/(dashboard)/settings`

### El bot se ejecuta pero va lento
**Posibles causas:**
1. MT5 no instalado
2. Python no instalado
3. Dependencias faltan
4. Servicio no se ejecuta

**Solución:**
1. Verificar que MT5 está instalado
2. Instalar MT5 desde el broker
3. Verificar que Python está instalado
4. Reinstalar el servicio
5. Revisar la configuración

### "Error de autenticación SaaS"
1. Verificar que el API key es correcto
2. Verificar que el SaaS está online
3. Verificar suscripción activa

**Solución:**
1. Renueva suscripción
2. Pagar la suscripción con tarjeta de crédito/débitito
3. Reinstalar el bot

---

## Contacto

Si necesitas ayuda:
- Email: soporte@tu-saas.com
- Incluye tu tenant ID y el problema
- Screenshot del error si contactes
