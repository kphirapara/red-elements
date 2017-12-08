import {
  RED,
  readPage,
  ctx as baseCtx,
  Tray
} from './imports'

function create(ctx) {
  return new Tray(ctx)
}
let events = {
  on(property, callback) { },
  emit(property) { }
}
let view = {
  focus() { }
}
let ctx = Object.assign({
  //actions,
  //keyboard,
  //utils,
  events,
  // settings,
  //nodes,
  view
}, baseCtx)

let tray
beforeEach(() => {
  tray = create(ctx)
})

beforeAll(() => {
  // Searchbox(RED)
  // EditableList(RED)
  document.documentElement.innerHTML = readPage('tray', __dirname)
})

let button = {
  id: 'my-button',
  text: 'click me',
  class: 'red',
  click() { }
}

let options = {
  basic: {
    title: 'my-title',
    width: 200,
    maximized: false,
    buttons: [
      button
    ]
  }
}

test('Tray: create', () => {
  expect(tray).toBeDefined()
})


test('Tray: has stack', () => {
  expect(tray.stack).toEqual([])
})

test('Tray: has editorStack', () => {
  expect(tray.editorStack).toBeDefined()
})

test('Tray: create has openingTray', () => {
  expect(tray.openingTray).toBeFalsy()
})

// calls showTray
test('Tray: show', () => {
  var tray = create(ctx);
  tray.show(options.basic)
  expect(tray).toBeDefined()
})

test('Tray: showTray', () => {
  tray.showTray(options.basic)
  expect(tray).toBeDefined()
})

test('Tray: close', async () => {
  tray.show(options.basic)
  tray.show(options.basic)
  let closed = await tray.close()
  expect(closed).toBeTruthy()
})

test('Tray: close', async () => {
  tray.show(options.basic)
  let closed = await tray.close()
  expect(closed).toBeTruthy()
})


test('Tray: resize', () => {
  tray.resize()
  expect(typeof tray.resize).toBe('function')
})

test('Tray: handleWindowResize', () => {
  tray.handleWindowResize()
  expect(typeof tray.handleWindowResize).toBe('function')
})

test('Tray: append element can be start dragging', () => {
  tray.showTray(options.basic)
  var elements = $(tray.editorStack).children();
  var ele = $(elements[0]).data('ui-draggable');
  ele.options.start(null, {
    position: { top: 50 }
  });
  expect(typeof ele.options.start).toBe('function');
})

test('Tray: append element can be draggable', () => {
  tray.showTray(options.basic)
  var elements = $(tray.editorStack).children();
  var ele = $(elements[0]).data('ui-draggable');
  ele.options.drag(null, {
    position: { top: 50, left: 52 }
  });
  expect(typeof ele.options.start).toBe('function');
})

test('Tray: append element can be stop dragging', () => {
  tray.showTray(options.basic)
  var elements = $(tray.editorStack).children();
  var ele = $(elements[0]).data('ui-draggable');
  ele.options.stop(null, {
    position: { top: 50, left: 52 }
  });
  expect(typeof ele.options.stop).toBe('function');
})