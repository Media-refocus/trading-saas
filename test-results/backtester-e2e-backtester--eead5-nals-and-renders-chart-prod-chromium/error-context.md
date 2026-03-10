# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Iniciar Sesion" [level=3] [ref=e6]
      - paragraph [ref=e7]: Ingresa tus credenciales para acceder a tu cuenta
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: Credenciales invalidas. Verifica tu email y password.
        - generic [ref=e11]:
          - text: Email
          - textbox "Email" [ref=e12]:
            - /placeholder: tu@email.com
            - text: guillermolhl@hotmail.com
        - generic [ref=e13]:
          - generic [ref=e14]:
            - generic [ref=e15]: Password
            - link "Olvidaste tu contraseña?" [ref=e16] [cursor=pointer]:
              - /url: /forgot-password
          - textbox "Password" [ref=e17]:
            - /placeholder: Tu password
            - text: test1234
      - generic [ref=e18]:
        - button "Iniciar Sesion" [ref=e19] [cursor=pointer]
        - generic [ref=e24]: o continua con
        - button "Continuar con Google" [ref=e25] [cursor=pointer]:
          - img [ref=e26]
          - text: Continuar con Google
        - paragraph [ref=e31]:
          - text: No tienes cuenta?
          - link "Registrate" [ref=e32] [cursor=pointer]:
            - /url: /register
  - alert [ref=e33]
```