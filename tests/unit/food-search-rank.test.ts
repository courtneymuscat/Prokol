import { describe, it, expect } from 'vitest'
import { rankFood, preparationBonus } from '@/lib/foodSearchRank'

// The food database stores one row per preparation, so an alphabetical list
// put "baked", "casseroled", "fried" and "grilled" above "raw" — a client
// logging plain chicken had to read past four wrong rows. Clients weigh food
// raw far more often than crumbed, so raw and lean cuts lead.
//
// The constraint pulling the other way: a branded search must still put the
// product first, rather than dragging a generic raw ingredient above the
// thing someone scanned off a tub.

const rank = (names: string[], query: string) => {
  const terms = query.toLowerCase().split(/\s+/)
  return [...names].sort((a, b) => rankFood(b, query, terms) - rankFood(a, query, terms))
}

describe('raw and lean lead for whole foods', () => {
  it('puts raw chicken breast above every cooked form', () => {
    expect(rank([
      'Chicken breast lean flesh baked no added fat',
      'Chicken breast lean flesh casseroled no added fat',
      'Chicken breast lean flesh fried no added fat',
      'Chicken breast lean flesh grilled no added fat',
      'Chicken breast lean flesh raw',
    ], 'chicken breast')[0]).toBe('Chicken breast lean flesh raw')
  })

  it('prefers lean flesh over skin and fat', () => {
    const [first] = rank(['Chicken breast lean flesh skin & fat raw', 'Chicken breast lean flesh raw'], 'chicken breast')
    expect(first).toBe('Chicken breast lean flesh raw')
  })

  it('puts raw broccoli above boiled and microwaved', () => {
    expect(rank([
      'Broccoli fresh baked no added fat',
      'Broccoli fresh boiled drained',
      'Broccoli fresh microwaved',
      'Broccoli fresh raw',
    ], 'broccoli')[0]).toBe('Broccoli fresh raw')
  })

  it('pushes crumbed and battered down', () => {
    const [first] = rank(['Fish fillet crumbed fried', 'Fish fillet raw'], 'fish fillet')
    expect(first).toBe('Fish fillet raw')
  })
})

describe('branded products still win their own search', () => {
  it('puts the brand match first, above a generic raw ingredient', () => {
    expect(rank([
      'Cottage Cheese',
      'Cottage cheese reduced fat raw milk',
      'Bulla Cottage Cheese',
      'Cheese cottage',
    ], 'bulla cottage cheese')[0]).toBe('Bulla Cottage Cheese')
  })

  it('exact product name beats a longer variant of it', () => {
    expect(rank(['Vegemite Reduced Salt', 'Vegemite'], 'vegemite')[0]).toBe('Vegemite')
  })

  it('a raw generic does not outrank the brand being searched', () => {
    expect(rank(['Yoghurt natural raw', 'Chobani Greek Yoghurt Plain'], 'chobani yoghurt')[0])
      .toBe('Chobani Greek Yoghurt Plain')
  })
})

describe('exact and prefix matches outrank preparation preference', () => {
  it('an exact name wins even without "raw" in it', () => {
    expect(rank(['Salmon Atlantic fillet raw', 'Salmon'], 'salmon')[0]).toBe('Salmon')
  })

  it('preparation adjustments stay small enough not to flip a match', () => {
    expect(Math.abs(preparationBonus('chicken raw'))).toBeLessThan(70)
    expect(Math.abs(preparationBonus('chicken crumbed fried'))).toBeLessThan(70)
  })
})
