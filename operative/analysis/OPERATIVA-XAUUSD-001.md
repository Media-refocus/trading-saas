# Operativa XAUUSD #001 — Xisco Vikingo Trading

**Fecha:** 2026-02-22
**Estado:** En testing (sin backtester aún)
**Símbolo:** XAUUSD (Oro)

---

## 📊 Resumen Ejecutivo

Estrategia de gestión progresiva con:
- 2 entradas iniciales por señal
- Primera entrada: TP fijo (20 pips)
- Segunda entrada: runner con trailing SL
- Martingala suave contra el precio (máx 40 niveles)
- Cierres parciales escalonados según pips acumulados

---

## 🎯 Reglas de Entrada

### Señal Inicial
```
Señal BUY/SELL → 2 entradas de 0.02 lotes cada una
```

### Gestión de las 2 entradas
| Entrada | Lotes | Comportamiento |
|---------|-------|----------------|
| 1ª | 0.02 | Cierra a los 20 pips (TP fijo) |
| 2ª | 0.02 | Se alarga, SL se mueve a partir de 30 pips |

---

## 📉 Pyramiding (si el precio va en contra)

### Tabla de Niveles

| Rango Pips | Espaciado | Lotes/Entrada | Entradas/Nivel | Acumulado |
|------------|-----------|---------------|----------------|-----------|
| 0-50 | cada 10 pips | 0.03 | 1 | ~5 niveles |
| 50-100 | cada 10 pips | 0.06 (doble) | 2 | ~10 niveles |
| 100-160 | cada 20 pips | (mismo) | 2 | ~13 niveles |
| 160-250 | cada 30 pips | (mismo) | 2 | ~16 niveles |
| 250+ | cada 50 pips | (mismo) | 4 | hasta 40 niveles |

**Regla:** Máximo 40 niveles de promedio

### Lógica de doblado
- A partir de 50 pips: "doblamos operaciones por entrada"
- Interpretación: pasamos de 0.03 → 0.06 por entrada (doble lotaje)

---

## 🔄 Reglas de Cierre (cuando va a favor)

### Escenarios según pips acumulados

#### Rango 400 → 250 pips (zona de ganancia alta)
```
SI pips >= 250 Y precio retrocede:
  - Cerrar 2 entradas a los 25 pips de retroceso
  - Dejar las demás correr

SI precio vuelve a subir:
  - Reabrir las 2 que aseguramos
```

#### Rango 250 → 160 pips
```
SI pips >= 160 Y retrocede:
  - Cerrar 1 cada 20 pips
  - La otra corre

SI vuelve a subir:
  - Reabrir la que aseguramos
```

#### Rango 160 → 100 pips
```
SI pips >= 100 Y retrocede:
  - Cerrar 1 operación a los 20 pips
  - La otra corre

SI vuelve a subir:
  - Reabrir la que aseguramos
```

#### Rango 100 → 40 pips
```
SI pips >= 40 Y retrocede:
  - Asegurar TODO cada 10 pips

SI vuelve a subir:
  - Seguir abriendo
```

#### Rango 40 → 0 pips
```
SI pips > 0 Y retrocede:
  - Asegurar cada 20 pips

SI vuelve a subir:
  - Seguir abriendo
```

---

## 🧮 Ejemplo de Flujo

### Escenario: Señal BUY a 2000.00

```
T=0:    Precio 2000.00 → 2 entradas 0.02 lotes
        - Entrada 1: TP @ 2002.00 (20 pips)
        - Entrada 2: Runner, SL se mueve desde 30 pips

T+10min: Precio 1999.00 (contra 10 pips)
        - Nueva entrada 0.03 lotes

T+20min: Precio 1998.00 (contra 20 pips)
        - Nueva entrada 0.03 lotes

T+30min: Precio 1997.00 (contra 30 pips)
        - Nueva entrada 0.03 lotes

T+40min: Precio 1996.00 (contra 40 pips)
        - Nueva entrada 0.03 lotes

T+50min: Precio 1995.00 (contra 50 pips)
        - Nueva entrada 0.06 lotes (doblamos)
        - Nivel 6 alcanzado

...continúa hasta máx 40 niveles...

T+2h:   Precio sube a 1998.00 (recuperación desde 1995)
        - Estamos en rango 50→100 pips
        - Si retrocede → asegurar
        - Si sube → seguir
```

---

## 🎯 Trailing SL (Entrada 2 - Runner)

**Activación:** A partir de 30-40 pips en positivo

**Comportamiento:**
```
SI pips >= 30:
  - Poner SL en +10 pips (breakeven + margen)

SI pips sube de 30 → 40 → 50...:
  - SL sube proporcionalmente (solo a favor)
  - NUNCA retrocede, solo avanza
```

**Ejemplo:**
```
Precio entrada: 2000.00
Precio actual:  2004.00 (+40 pips) → SL en 2001.00 (+10 pips)
Precio sube a:  2006.00 (+60 pips) → SL sube a 2003.00 (+30 pips)
Precio cae a:   2004.00 (+40 pips) → SL SIGUE en 2003.00 (no retrocede)
```

---

## ⚠️ Riesgos Identificados

1. **Martingala expuesta:** 40 niveles pueden acumular mucho lotaje
2. **Sin stop global:** Pendiente sistema de gestión de riesgo
3. **Depende de recuperación:** Si el precio nunca vuelve, pérdidas grandes
4. **Complejidad:** Muchas reglas de cierre condicionales

---

## ⏰ Horarios y Condiciones

| Situación | Acción |
|-----------|--------|
| Aperturas de mercado | Ir con mucho ojo |
| Noticias (justo al dato) | NO operar, esperar buen punto |
| Noticias (después) | Buscar entrada favorable |

---

## ❓ Preguntas para Xisco

1. ~~¿Qué pasa si llegamos a 40 niveles?~~ → **Pendiente sistema gestión riesgo**

2. ~~¿El trailing SL de la entrada 2?~~ → **ACLARADO: Trailing solo a favor desde 30-40 pips**

3. ~~¿"Doblamos operaciones" a los 50 pips?~~ → **ACLARADO: Doblamos CANTIDAD de entradas (no lotaje)**

4. **¿Cierres FIFO o LIFO?** (aclaro la pregunta abajo)

5. ~~¿Horarios prohibidos?~~ → **ACLARADO: Cuidado aperturas, evitar noticias al dato**

---

## 📤 Orden de Cierre: LIFO

Cuando hay varias operaciones abiertas y hay que cerrar algunas:

**LIFO (Last In, First Out):**
- Cerramos las MÁS NUEVAS primero
- Las que tienen mejor precio (del promedio)
- Las más viejas siguen corriendo

**Ejemplo:**
```
4 operaciones abiertas:
  Op 1: precio 2000.00 (vieja)
  Op 2: precio 1995.00 (vieja)
  Op 3: precio 1990.00 (nueva - promedio)
  Op 4: precio 1985.00 (nueva - promedio)

"Cerrar 2 entradas" → Cierra Op 3 y Op 4 (las más nuevas)
```

---

## 🔧 Parámetros Configurables (para SaaS)

```python
OPERATIVA_001 = {
    "nombre": "Xisco Progressive",
    "version": "1.0",

    "entrada_inicial": {
        "lotes": 0.02,
        "num_entradas": 2,
        "tp_fijo_entrada_1": 20,  # pips
        "trailing_inicio_entrada_2": 30  # pips
    },

    "pyramiding": {
        "max_niveles": 40,
        "niveles": [
            {"desde": 0, "hasta": 50, "espaciado": 10, "lotes": 0.03, "entradas": 1},
            {"desde": 50, "hasta": 100, "espaciado": 10, "lotes": 0.06, "entradas": 2},
            {"desde": 100, "hasta": 160, "espaciado": 20, "lotes": 0.06, "entradas": 2},
            {"desde": 160, "hasta": 250, "espaciado": 30, "lotes": 0.06, "entradas": 2},
            {"desde": 250, "hasta": 99999, "espaciado": 50, "lotes": 0.06, "entradas": 4}
        ]
    },

    "cierre_progresivo": [
        {"rango": [400, 250], "cerrar_cada": 25, "cantidad": 2, "reabrir_si_sube": True},
        {"rango": [250, 160], "cerrar_cada": 20, "cantidad": 1, "reabrir_si_sube": True},
        {"rango": [160, 100], "cerrar_cada": 20, "cantidad": 1, "reabrir_si_sube": True},
        {"rango": [100, 40], "cerrar_cada": 10, "cantidad": "todas", "reabrir_si_sube": True},
        {"rango": [40, 0], "cerrar_cada": 20, "cantidad": "todas", "reabrir_si_sube": True}
    ]
}
```

---

## ❓ Preguntas para Xisco

1. **¿Qué pasa si llegamos a 40 niveles?** ¿Hay un stop loss global de cuenta?

2. **¿El trailing SL de la entrada 2** se mueve cada cuántos pips? ¿Breakeven a los 30?

3. **¿"Doblamos operaciones" a los 50 pips** significa pasar de 0.03 a 0.06, o de 1 entrada a 2 entradas?

4. **¿Los cierres parciales** cierran las más viejas o las más nuevas? (FIFO vs LIFO)

5. **¿Hay horarios prohibidos?** (ej: no operar en news de alto impacto)

---

## ✅ Siguiente Paso

Cuando el backtester esté listo:
1. Cargar esta operativa como parámetros
2. Testear con señales históricas de Xisco
3. Validar resultados vs trades reales
4. Ajustar parámetros si es necesario
