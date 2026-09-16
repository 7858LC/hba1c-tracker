/**
 * Generic, editable starting points — not personalized recommendations.
 * Each is a common lifestyle-lever pattern (time-restricted eating,
 * carb targets, movement, sleep) that a user picks, edits freely, and
 * owns. Nothing here is derived from any user's data or health status.
 */

export interface ProtocolTemplate {
  id: string
  name: string
  description: string
  rules: string[]
}

export const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'time-restricted-eating',
    name: '16:8 Time-Restricted Eating',
    description: 'Eating window + post-meal movement.',
    rules: [
      'Eat only within an 8-hour window',
      'Stop eating 3h before bed',
      '15-30 min walk after the largest meal',
    ],
  },
  {
    id: 'carb-focus',
    name: 'Carb-Focused',
    description: 'Carb ceiling + meal composition.',
    rules: [
      'Keep carbs under 130g for the day',
      'Protein or fiber at every meal',
      'No sugar-sweetened drinks',
    ],
  },
  {
    id: 'movement-focus',
    name: 'Movement-Focused',
    description: 'Daily activity targets.',
    rules: [
      '30 min moderate exercise',
      '10 min walk after each meal',
      'Stand or move at least once per hour',
    ],
  },
  {
    id: 'sleep-stress',
    name: 'Sleep & Stress',
    description: 'Sleep consistency and wind-down.',
    rules: [
      '7+ hours of sleep',
      'Consistent sleep/wake time',
      '10 min wind-down with no screens before bed',
    ],
  },
  {
    id: 'balanced-starter',
    name: 'Balanced Starter',
    description: 'One rule from each area, for a lighter first pass.',
    rules: [
      'Eat only within an 8-hour window',
      'Keep carbs under 130g for the day',
      '15-30 min walk after the largest meal',
      '7+ hours of sleep',
    ],
  },
]
