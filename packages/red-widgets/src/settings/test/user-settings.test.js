import {
  RED,
  readPage,
  ctx as baseCtx,
  UserSettings
} from './imports'


function create(ctx) {
  return new UserSettings(ctx)
}

let events = {
  on() {}
}
let actions = {
  add() {},
  get() {}
}

function Settings() {
  return {
    theme() {},
    get(setting) {
      return this[setting]
    },
    set(setting, value) {
      this[setting] = value
    }
  }
}

let view = {
  gridSize: 20
}

let tray = {
  show() {}
}

const ctx = Object.assign({
  events,
  actions,
  settings: new Settings(),
  view,
  tray
}, baseCtx)

let settings
beforeEach(() => {
  settings = create(ctx)
})

beforeAll(() => {
  // Searchbox(RED)
  // EditableList(RED)

  document.documentElement.innerHTML = readPage('simple')
})

test('UserSettings: create', () => {
  expect(settings).toBeDefined()
})

test('UserSettings: has viewSettings', () => {
  expect(settings.viewSettings.length).toBeGreaterThan(2)
  expect(settings.viewSettings[0].title).toBe('menu.label.view.grid')
})

test('UserSettings: addPane', () => {
  let options = {
    id: 'x'
  }
  settings.addPane(options)
  let pane = settings.panes[0]
  expect(pane.id).toEqual('view')
})

test('UserSettings: show', () => {
  let initialTab = {}
  settings.show(initialTab)
  expect(settings.settingsVisible).toBeTruthy()
})

test('UserSettings: createViewPane', () => {
  let viewPane = settings.createViewPane()
  expect(viewPane).toBeDefined()
})

function settingsFor(settings) {
  return function (id) {
    return settings.RED.settings.get(id)
  }
}

test('UserSettings: setSelected', () => {
  // RED.settings.set(opt.setting, value);
  let id = 'view-grid-size'
  let value = 30
  settings.setSelected(id, value)
  let setting = settingsFor(settings)
  expect(setting(id)).toEqual(30)
})

test('UserSettings: toggle', () => {
  let id = 'view-snap-grid'
  let setting = settingsFor(settings)
  expect(setting(id)).toEqual(true)
  settings.toggle(id)
  expect(setting(id)).toEqual(false)
})
