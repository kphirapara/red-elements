import {
  test,
  nightmare,
  controllers
} from '../imports'

const {
  Tray
} = controllers

const ctx = {}

function create(ctx) {
  return new Tray(ctx)
}

test('Tray: create', t => {
  let tray = create(ctx)
  t.deepEqual(tray.stack, [])
  t.false(tray.openingTray)
})

test('Tray: show', t => {
  let tray = create(ctx)
  let options = {

  }
  tray.show(options)
  // use nightmare
})

test('Tray: close', async t => {
  let tray = create(ctx)
  await tray.close()
  // use nightmare
})

test('Tray: resize', t => {
  let tray = create(ctx)
  tray.resize()
  // use nightmare
})

test('Tray: showTray', t => {
  let tray = create(ctx)
  let options = {

  }
  tray.showTray(options)
  // use nightmare
})

test('Tray: handleWindowResize', t => {
  let tray = create(ctx)
  tray.handleWindowResize()
  // use nightmare
})