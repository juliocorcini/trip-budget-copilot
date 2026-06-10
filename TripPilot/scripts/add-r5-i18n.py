#!/usr/bin/env python3
"""Add R5 i18n keys to all locales (en, pt-BR, es) keeping parity."""
import json
from collections import OrderedDict
from pathlib import Path

LOCALES_DIR = Path(__file__).resolve().parent.parent / 'src' / 'i18n' / 'locales'

KEYS = {
    'en': {
        'data_error': {
            'title': 'Could not load your data',
            'body': 'Your data was NOT deleted — the local database just failed to respond. Close other tabs of the app and try again.',
            'retry': 'Try again',
        },
        'backup': {
            'operation_failed': 'The operation failed. Nothing was changed — try again.',
        },
        'dashboard': {
            'storage_not_persisted': 'Your data may be cleared by the system. Enable protected storage in Settings.',
        },
        'onboarding': {
            'phase_details_hint': 'The first phase starts with the trip dates — adjust if it covers only part of the trip.',
            'phase_start_date': 'Phase start',
            'phase_end_date': 'Phase end',
        },
        'planner': {
            'added_breakdown': 'You added {{items}}',
        },
    },
    'pt-BR': {
        'data_error': {
            'title': 'Não foi possível carregar seus dados',
            'body': 'Seus dados NÃO foram apagados — o banco local apenas não respondeu. Feche outras abas do app e tente de novo.',
            'retry': 'Tentar novamente',
        },
        'backup': {
            'operation_failed': 'A operação falhou. Nada foi alterado — tente novamente.',
        },
        'dashboard': {
            'storage_not_persisted': 'Seus dados podem ser limpos pelo sistema. Ative o armazenamento protegido em Configurações.',
        },
        'onboarding': {
            'phase_details_hint': 'A primeira fase começa com as datas da viagem — ajuste se ela cobrir só uma parte.',
            'phase_start_date': 'Início da fase',
            'phase_end_date': 'Fim da fase',
        },
        'planner': {
            'added_breakdown': 'Você adicionou {{items}}',
        },
    },
    'es': {
        'data_error': {
            'title': 'No se pudieron cargar tus datos',
            'body': 'Tus datos NO fueron borrados — la base local simplemente no respondió. Cierra otras pestañas de la app e inténtalo de nuevo.',
            'retry': 'Intentar de nuevo',
        },
        'backup': {
            'operation_failed': 'La operación falló. No se cambió nada — inténtalo de nuevo.',
        },
        'dashboard': {
            'storage_not_persisted': 'El sistema puede borrar tus datos. Activa el almacenamiento protegido en Configuración.',
        },
        'onboarding': {
            'phase_details_hint': 'La primera fase comienza con las fechas del viaje — ajústala si cubre solo una parte.',
            'phase_start_date': 'Inicio de la fase',
            'phase_end_date': 'Fin de la fase',
        },
        'planner': {
            'added_breakdown': 'Agregaste {{items}}',
        },
    },
}

REMOVED_KEYS = [('planner', 'added_count')]

for locale, sections in KEYS.items():
    path = LOCALES_DIR / f'{locale}.json'
    data = json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=OrderedDict)
    for section, entries in sections.items():
        if section not in data:
            data[section] = OrderedDict()
        for key, value in entries.items():
            data[section][key] = value
    for section, key in REMOVED_KEYS:
        data.get(section, {}).pop(key, None)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{locale}: ok')
