#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
automejora_parametros.py - Sistema de automejora de parámetros de backtesting

Analiza los resultados del backtesting (ranges.csv) y recomienda ajustes
automáticos de parámetros para mejorar la operativa.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple
import json

# Configuración
PROJECT_ROOT = Path("C:/Users/guill/Projects/trading-bot-saas")
RESULTS_DIR = PROJECT_ROOT / "backtest_results"
OPTIMIZACION_DIR = PROJECT_ROOT / "optimizacion"

# Crear carpetas si no existen
RESULTS_DIR.mkdir(exist_ok=True)
OPTIMIZACION_DIR.mkdir(exist_ok=True)


def analyze_ranges_csv(csv_path: Path) -> Dict:
    """Analiza un archivo ranges.csv y extrae métricas clave."""

    if not csv_path.exists():
        print(f"[ERROR] No existe {csv_path}")
        return {}

    df = pd.read_csv(csv_path, sep=';')

    # Métricas básicas
    total_ranges = len(df)
    if total_ranges == 0:
        return {}

    # Win rate
    df['win'] = df['pnl_total_pips'] > 0
    win_rate = (df['win'].sum() / total_ranges) * 100

    # PnL stats
    avg_pnl = df['pnl_total_pips'].mean()
    median_pnl = df['pnl_total_pips'].median()
    std_pnl = df['pnl_total_pips'].std()

    # MFE/MAE
    avg_mfe = df['mfe_pips'].mean()
    avg_mae = df['mae_pips'].mean()
    max_mae = df['mae_pips'].min()  # Más negativo

    # Niveles usados
    avg_levels = df['max_levels'].mean() if 'max_levels' in df.columns else 0
    max_levels_used = df['max_levels'].max() if 'max_levels' in df.columns else 0

    # S00 cerrados
    s00_closed_rate = 0
    if 's00_closed' in df.columns:
        s00_closed_rate = (df['s00_closed'] == '1').sum() / total_ranges * 100

    return {
        'csv_name': csv_path.stem,
        'total_ranges': total_ranges,
        'win_rate': win_rate,
        'avg_pnl': avg_pnl,
        'median_pnl': median_pnl,
        'std_pnl': std_pnl,
        'avg_mfe': avg_mfe,
        'avg_mae': avg_mae,
        'max_adverse_pips': abs(max_mae) if max_mae < 0 else 0,
        'avg_levels': avg_levels,
        'max_levels_used': max_levels_used,
        's00_closed_rate': s00_closed_rate,
        'profit_factor': abs(df[df['pnl_total_pips'] > 0]['pnl_total_pips'].sum() /
                               df[df['pnl_total_pips'] < 0]['pnl_total_pips'].sum())
                           if df[df['pnl_total_pips'] < 0]['pnl_total_pips'].sum() != 0 else 0
    }


def recommend_scalper_tp(metrics: Dict, current_tp: int) -> Dict:
    """Recomienda ajuste del TP del S00 scalper."""
    recommendations = []

    if metrics['s00_closed_rate'] < 30:
        # El S00 no está cerrando suficiente, quizás TP muy alto
        new_tp = max(10, current_tp - 5)
        recommendations.append({
            'param': 'InpScalperTPPips',
            'current': current_tp,
            'recommended': new_tp,
            'reason': f"S00 solo cierra el {metrics['s00_closed_rate']:.1f}% de las veces. "
                     f"Reducir TP de {current_tp} a {new_tp} pips para más cierres.",
            'expected_impact': 'Aumentar win rate de S00'
        })

    elif metrics['s00_closed_rate'] > 80:
        # El S00 está cerrando casi siempre, quizás podemos subir TP
        new_tp = current_tp + 5
        recommendations.append({
            'param': 'InpScalperTPPips',
            'current': current_tp,
            'recommended': new_tp,
            'reason': f"S00 cierra el {metrics['s00_closed_rate']:.1f}% de las veces. "
                     f"Podemos aumentar TP de {current_tp} a {new_tp} pips para más profit.",
            'expected_impact': 'Aumentar profit por trade'
        })

    return recommendations


def recommend_grid_distance(metrics: Dict, current_step: int, strategy: str) -> Dict:
    """Recomienda ajuste de distancia entre promedios."""
    recommendations = []

    # Si el MAE máximo es mayor que 3x la distancia del grid...
    max_adverse_ratio = metrics['max_adverse_pips'] / current_step

    if max_adverse_ratio > 4:
        # El precio va mucho más lejos que nuestros promedios
        new_step = current_step + 10
        recommendations.append({
            'param': 'InpStepPips',
            'current': current_step,
            'recommended': new_step,
            'reason': f"MAE máximo ({metrics['max_adverse_pips']:.1f} pips) es {max_adverse_ratio:.1f}x la distancia actual. "
                     f"Aumentar step de {current_step} a {new_step} pips para cubrir más",
            'expected_impact': 'Mejorar cobertura de promedios'
        })

    elif max_adverse_ratio < 2 and metrics['avg_levels'] < 2:
        # El precio no va mucho lejos y usamos pocos promedios
        new_step = max(10, current_step - 5)
        recommendations.append({
            'param': 'InpStepPips',
            'current': current_step,
            'recommended': new_step,
            'reason': f"MAE máximo ({metrics['max_adverse_pips']:.1f} pips) es solo {max_adverse_ratio:.1f}x la distancia. "
                     f"Reducir step de {current_step} a {new_step} pips para más agresividad",
            'expected_impact': 'Más entradas en promedios, mejor BE'
        })

    return recommendations


def recommend_max_levels(metrics: Dict, current_max: int) -> Dict:
    """Recomienda ajuste de niveles máximos."""
    recommendations = []

    if metrics['max_levels_used'] >= current_max:
        # Estamos usando todos los niveles
        new_max = current_max + 1
        recommendations.append({
            'param': 'InpMaxLevels',
            'current': current_max,
            'recommended': new_max,
            'reason': f"Se están usando todos los {current_max} niveles disponibles. "
                     f"Aumentar a {new_max} para no cortar promedios.",
            'expected_impact': 'Mejorar cobertura en rangos largos'
        })

    elif metrics['max_levels_used'] < current_max * 0.5:
        # Usamos menos de la mitad de los niveles
        new_max = max(1, metrics['max_levels_used'] + 1)
        recommendations.append({
            'param': 'InpMaxLevels',
            'current': current_max,
            'recommended': new_max,
            'reason': f"Solo se usan max {metrics['max_levels_used']} niveles de {current_max}. "
                     f"Reducir a {new_max} para simplificar.",
            'expected_impact': 'Reducir complejidad sin perder cobertura'
        })

    return recommendations


def optimize_strategy(csv_name: str, current_params: Dict) -> Dict:
    """Optimiza una estrategia completa basándose en resultados."""

    csv_path = RESULTS_DIR / f"{csv_name}.csv"
    metrics = analyze_ranges_csv(csv_path)

    if not metrics:
        return {'error': f"No se pudieron analizar {csv_path}"}

    recommendations = []

    # Analizar cada parámetro
    recommendations.extend(recommend_scalper_tp(
        metrics,
        current_params.get('scalper_tp', 20)
    ))

    recommendations.extend(recommend_grid_distance(
        metrics,
        current_params.get('step_pips', 20),
        csv_name
    ))

    recommendations.extend(recommend_max_levels(
        metrics,
        current_params.get('max_levels', 4)
    ))

    return {
        'strategy': csv_name,
        'metrics': metrics,
        'current_params': current_params,
        'recommendations': recommendations,
        'overall_score': calculate_score(metrics)
    }


def calculate_score(metrics: Dict) -> float:
    """Calcula un score de 0-100 para la estrategia."""
    score = 0.0

    # Win rate (30%)
    if metrics['win_rate'] > 60:
        score += 30
    elif metrics['win_rate'] > 50:
        score += 20
    elif metrics['win_rate'] > 40:
        score += 10

    # Profit factor (30%)
    if metrics['profit_factor'] > 2.0:
        score += 30
    elif metrics['profit_factor'] > 1.5:
        score += 20
    elif metrics['profit_factor'] > 1.2:
        score += 10

    # Avg PnL (20%)
    if metrics['avg_pnl'] > 50:
        score += 20
    elif metrics['avg_pnl'] > 20:
        score += 10
    elif metrics['avg_pnl'] > 0:
        score += 5

    # Max drawdown control (20%)
    if metrics['max_adverse_pips'] < 100:
        score += 20
    elif metrics['max_adverse_pips'] < 200:
        score += 10
    elif metrics['max_adverse_pips'] < 300:
        score += 5

    return min(100, score)


def generate_optimized_ea(recommendations: List[Dict], strategy_name: str) -> str:
    """Genera código MQL5 con parámetros optimizados."""

    params_code = "// PARÁMETROS OPTIMIZADOS POR AUTOMEJORA\n"
    params_code += f"// Estrategia: {strategy_name}\n"
    params_code += f"// Fecha: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    for rec in recommendations:
        params_code += f"// {rec['reason']}\n"
        params_code += f"// Impacto esperado: {rec['expected_impact']}\n"
        params_code += f"input {get_input_type(rec['param'])}  {rec['param']} = {rec['recommended']}; "
        params_code += f"// {rec['current']} → {rec['recommended']}\n\n"

    return params_code


def get_input_type(param_name: str) -> str:
    """Devuelve el tipo MQL5 del parámetro."""
    if 'TPPips' in param_name or 'StepPips' in param_name or 'MaxLevels' in param_name:
        return 'int'
    return 'double'


def run_optimization():
    """Ejecuta el ciclo completo de optimización."""

    print("=" * 80)
    print("SISTEMA DE AUTOMEJORA DE PARÁMETROS")
    print("=" * 80)

    # Configuración actual de cada estrategia
    strategies = {
        'ranges_G2': {
            'scalper_tp': 20,
            'step_pips': 30,
            'max_levels': 4
        },
        'ranges_G4': {
            'scalper_tp': 20,
            'step_pips': 20,
            'max_levels': 4
        },
        'ranges_Restrictions': {
            'scalper_tp': 20,
            'step_pips': 20,
            'max_levels': 4
        }
    }

    results = []
    all_recommendations = []

    # Analizar cada estrategia
    for strategy, params in strategies.items():
        print(f"\n{'='*60}")
        print(f"ANALIZANDO: {strategy}")
        print(f"{'='*60}")

        result = optimize_strategy(strategy, params)

        if 'error' in result:
            print(f"[ERROR] {result['error']}")
            continue

        results.append(result)

        # Mostrar métricas
        print(f"\nMÉTRICAS:")
        for key, value in result['metrics'].items():
            print(f"  {key}: {value:.2f}" if isinstance(value, float) else f"  {key}: {value}")

        # Mostrar score
        print(f"\nSCORE GLOBAL: {result['overall_score']:.1f}/100")

        # Mostrar recomendaciones
        if result['recommendations']:
            print(f"\nRECOMENDACIONES ({len(result['recommendations'])}):")
            for i, rec in enumerate(result['recommendations'], 1):
                print(f"\n  [{i}] {rec['param']}")
                print(f"      Actual: {rec['current']}")
                print(f"      Recomendado: {rec['recommended']}")
                print(f"      Razón: {rec['reason']}")
                print(f"      Impacto: {rec['expected_impact']}")

            all_recommendations.extend(result['recommendations'])
        else:
            print("\n✓ No hay recomendaciones - Estrategia optimizada")

    # Generar reporte JSON
    report = {
        'timestamp': pd.Timestamp.now().isoformat(),
        'strategies': results,
        'total_recommendations': len(all_recommendations)
    }

    report_path = OPTIMIZACION_DIR / f"reporte_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*80}")
    print(f"REPORTE GUARDADO: {report_path}")
    print(f"{'='*80}")

    # Generar código optimizado si hay recomendaciones
    if all_recommendations:
        print("\nGENERANDO CÓDIGO MQL5 OPTIMIZADO...")

        for strategy in strategies.keys():
            strategy_recs = [r for r in all_recommendations]  # Todas las recomendaciones

            if strategy_recs:
                code = generate_optimized_ea(strategy_recs, strategy)
                code_path = OPTIMIZACION_DIR / f"{strategy}_optimized_params.mqh"

                with open(code_path, 'w', encoding='utf-8') as f:
                    f.write(code)

                print(f"  {code_path}")

    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "analyze":
        # Solo analizar un CSV específico
        csv_name = sys.argv[2] if len(sys.argv) > 2 else "ranges_G2"
        csv_path = RESULTS_DIR / f"{csv_name}.csv"

        print(f"Analizando {csv_path}...")
        metrics = analyze_ranges_csv(csv_path)

        print(f"\nResultados para {csv_name}:")
        for key, value in metrics.items():
            print(f"  {key}: {value:.2f}" if isinstance(value, float) else f"  {key}: {value}")
    else:
        # Ejecutar optimización completa
        run_optimization()
