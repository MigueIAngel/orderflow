import { beforeEach, describe, expect, it } from 'vitest'
import { cartTotal, MAX_PER_LINE, useCart } from './cart'

describe('cart store', () => {
  beforeEach(() => useCart.setState({ lines: {}, email: '' }))

  it('adds units and caps each line', () => {
    const { add, setQuantity } = useCart.getState()
    add('KB-001')
    add('KB-001')
    expect(useCart.getState().lines).toEqual({ 'KB-001': 2 })
    setQuantity('KB-001', 999)
    expect(useCart.getState().lines['KB-001']).toBe(MAX_PER_LINE)
  })

  it('removes a line when its quantity drops to zero', () => {
    useCart.getState().add('MS-002')
    useCart.getState().setQuantity('MS-002', 0)
    expect(useCart.getState().lines).toEqual({})
  })

  it('computes totals with two decimals', () => {
    expect(cartTotal({ A: 3, B: 1 }, { A: 0.1, B: 39.9 })).toBe(40.2)
  })
})
