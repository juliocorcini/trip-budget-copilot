# TripPilot — Orquestrador "Replan Quality" (fonte de verdade de execução)

> **App:** 2.11.0-rc → 2.11.2-rc · **Status:** ACTIVE

## Missão

O AI Copilot mid-trip replan está passando dados errados: budget TOTAL em vez do restante, duração TOTAL em vez dos dias restantes. Resultado: planos absurdos (€1206 para €628 de budget). Corrigir dados, prompt e safety net.

## Change-set

| ID | Item | Gate |
|----|------|:----:|
| D01 | Passar `remainingBudgetCents` e `remainingDays` no mid-trip replan | G1 |
| D02 | Prompt: "plan ONLY for remaining N days with remaining X cents" | G1 |
| D03 | Worker: clampar plano que excede 110% do free budget (reduzir qty) | G1 |
| D04 | Resultado: header mostra "Budget restante" em vez de "livres" | G1 |
| D05 | Pool: transação clicável → navega para editar/remover | G2 |
| D06 | Pool: permitir excluir transação de ajuste | G2 |

## 17. GO

Execute G1→G2 sem parar.
