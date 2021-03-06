const nightmare = require('../nightmare')
import test from 'ava'
import {
  SidebarTabConfig
} from './ui'
const ctx = {}

function create(ctx) {
  return new SidebarTabConfig(ctx)
}


test('Sidebar TabConfig: create', () => {
  let tc = create(ctx)
  t.deepEqual(tc.categories, {})
})

// fix
test('TabConfig: getOrCreateCategory', () => {
  let tc = create(ctx)
  let name = 'abc',
    parent = {},
    label = 'xyz'

  let expected = {}
  let category = tc.getOrCreateCategory(name, parent, label)
  t.deepEqual(category, expected)
})

test('TabConfig: createConfigNodeList', () => {
  let tc = create(ctx)
  let id = 'abc'
  let node = {
    id: 'x'
  }
  let nodes = [
    node
  ]

  let expected = {}
  tc.createConfigNodeList(id, nodes)
  t.deepEqual(category, expected)
})

test('TabConfig: refreshConfigNodeList', () => {
  let tc = create(ctx)
  tc.refreshConfigNodeList()
  // TODO
  // t.is()
})

test('TabConfig: show', () => {
  let tc = create(ctx)
  let id = 'x'
  tc.show(id)
  // TODO
  // t.is()
})
