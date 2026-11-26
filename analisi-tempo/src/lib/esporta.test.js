import { it, expect } from 'vitest'
import { csvDettaglio, nomeFile } from './esporta.js'

it('CSV: una nota con ; e virgolette non sposta le colonne', () => {
  const csv = csvDettaglio(
    [{ ora_inizio: '2026-11-03T08:00:00Z', minuti: 60, categoria_id: 'a', nota: 'Riunione; "fornitori"', delegabile: true }],
    [{ id: 'a', nome: 'Supervisione' }],
    [],
  )
  expect(csv.startsWith('﻿')).toBe(true) // accenti corretti in Excel
  expect(csv).toContain('03/11/2026;09:00;60;Supervisione;;sì;;"Riunione; ""fornitori"""')
})

it('nome file senza accenti e spazi', () => {
  expect(nomeFile('Settimana 23 nov – 29 nov', 'pdf')).toBe('tempo_settimana-23-nov-29-nov.pdf')
})
