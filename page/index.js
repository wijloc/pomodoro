// Pomodoro para Zepp OS — versão API 1.0
// Amazfit "GTR 4 new" (deviceSource 9437441, tela 480x480, Zepp OS 1.0).
//
// Como funciona:
// - O estado (fase, horário de fim, ciclos) fica salvo com hmFS.SysProSetChars, então o
//   tempo continua certo mesmo se você sair do app: ao reabrir, ele recalcula.
//   (Esse armazenamento é apagado se o relógio reiniciar.)
// - Ao iniciar uma fase, um alarme do sistema (hmApp.alarmNew) é agendado para o fim dela:
//   se o app estiver fechado, o relógio o reabre, e ele vibra mostrando um overlay.
//
// Regra de layout: nada pode sobrepor o anel de progresso. Todo widget fica dentro do
// círculo interno do anel (centro 240,240, raio útil ~200).

// ---------- Configuração ----------
const MIN = 60 * 1000
const DURATION = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN }
const LONG_EVERY = 4 // pausa longa a cada 4 focos
const LABEL = { focus: 'FOCO', short: 'PAUSA', long: 'PAUSA LONGA' }
const COLOR = { focus: 0x0a84ff, short: 0x34c759, long: 0x8e8e93 }
const KEY = 'pomodoro_state'

const APP_ID = 27808 // TEM que ser igual a app.appId do app.json (usado pelo alarme)
const VIBE_SCENE = 5 // vibração longa e contínua, igual ao alarme/contagem do relógio
const VIBE_MS = 6000 // quanto tempo vibra no fim da fase (tocar no overlay para antes)
const TEST_MS = 15000 // atalho de teste (segurar o botão físico de baixo)
const ALARM_SLACK = 2 // s; o alarme fica 2s depois do fim para o app aberto tratar primeiro

// ---------- Estado persistido ----------
function freshState() {
  return { phase: 'focus', running: false, endAt: 0, remaining: DURATION.focus, done: 0, alarmId: 0 }
}

function loadState() {
  try {
    const raw = hmFS.SysProGetChars(KEY)
    return raw ? Object.assign(freshState(), JSON.parse(raw)) : freshState()
  } catch (e) {
    return freshState()
  }
}

function saveState(s) {
  try {
    hmFS.SysProSetChars(KEY, JSON.stringify(s))
  } catch (e) {}
}

function fmt(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(t / 60)
  const s = t % 60
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
}

// Executa fn e, se der erro, registra no log (visível no `zeus bridge`) sem travar o resto.
function safe(tag, fn) {
  try {
    return fn()
  } catch (e) {
    console.log('[pomodoro] ' + tag + ': ' + (e && e.message ? e.message : e))
  }
}

// ---------- Layout (tudo dentro do anel) ----------
const ARC = { x: 16, y: 16, w: 448, h: 448, line_width: 16 }
const LABEL_BOX = { x: 110, y: 100, w: 260, h: 40 }
const TIME_BOX = { x: 70, y: 142, w: 340, h: 100 }
const APPLE = { size: 40, gap: 12, y: 248 }
const MAIN_BTN = {
  x: 150, y: 300, w: 180, h: 60, radius: 30,
  normal_color: 0x333333, press_color: 0x555555,
  text: 'Iniciar', text_size: 32, color: 0xffffff,
}
const SMALL_BTN = {
  y: 368, w: 100, h: 42, radius: 21,
  normal_color: 0x1c1c1c, press_color: 0x3a3a3a,
  text_size: 24, color: 0xcccccc,
}

// O estado fica num objeto do módulo (P), não no `this` do Page: na API 1.0 o `this`
// que chega em onInit, build e nos callbacks não é confiável (state chegava null).
const P = {
  state: null,
  w: {},
  timer: null,
  vibrator: null,
  vibeTimer: null,
  mainText: '',

  onInit() {
    this.state = loadState()
  },

  build() {
    if (!this.state) this.state = loadState()
    safe('ui', () => this.drawUI())
    // o timer é criado antes do primeiro tick: se o tick falhar, o relógio continua andando
    this.timer = safe('timer', () =>
      timer.createTimer(1000, 1000, () => safe('tick', () => this.tick()), {})
    )
    safe('tick0', () => this.tick())
    safe('keys', () => this.listenKeys())
    // se a tela apagar, ao acordar o relógio volta para o app em vez do mostrador
    safe('keep', () => hmApp.setScreenKeep(true))
    if (this.state.running) safe('screen', () => this.keepScreenOn())
  },

  onDestroy() {
    safe('unkeys', () => hmApp.unregisterKeyEvent())
    if (this.timer) timer.stopTimer(this.timer)
    this.stopVibration()
    this.releaseScreen()
    saveState(this.state)
  },

  // ---------- UI ----------
  drawUI() {
    hmUI.createWidget(hmUI.widget.ARC, Object.assign({}, ARC, {
      start_angle: -90,
      end_angle: 270,
      color: 0x222222,
    }))

    this.w.arc = hmUI.createWidget(hmUI.widget.ARC, Object.assign({}, ARC, {
      start_angle: -90,
      end_angle: 270,
      color: COLOR.focus,
    }))

    this.w.label = hmUI.createWidget(hmUI.widget.TEXT, Object.assign({}, LABEL_BOX, {
      text: '', text_size: 30, color: COLOR.focus,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
    }))

    this.w.time = hmUI.createWidget(hmUI.widget.TEXT, Object.assign({}, TIME_BOX, {
      text: '25:00', text_size: 88, color: 0xffffff,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
    }))

    // uma maçã por foco concluído no ciclo atual; bolinha vazia para os que faltam
    const rowW = LONG_EVERY * APPLE.size + (LONG_EVERY - 1) * APPLE.gap
    const x0 = 240 - rowW / 2
    this.w.apples = []
    for (let i = 0; i < LONG_EVERY; i++) {
      this.w.apples.push(hmUI.createWidget(hmUI.widget.IMG, {
        x: x0 + i * (APPLE.size + APPLE.gap), y: APPLE.y,
        w: APPLE.size, h: APPLE.size,
        src: 'dot.png',
      }))
    }
    this.appleState = []

    this.w.main = hmUI.createWidget(hmUI.widget.BUTTON, Object.assign({}, MAIN_BTN, {
      click_func: () => safe('toggle', () => this.toggle()),
    }))
    this.mainText = MAIN_BTN.text

    hmUI.createWidget(hmUI.widget.BUTTON, Object.assign({}, SMALL_BTN, {
      x: 134, text: 'Zerar',
      click_func: () => safe('reset', () => this.reset()),
    }))

    hmUI.createWidget(hmUI.widget.BUTTON, Object.assign({}, SMALL_BTN, {
      x: 246, text: 'Pular',
      click_func: () => safe('skip', () => this.skip()),
    }))

    // overlay de alerta: criado por último para ficar por cima de tudo; tocar para a vibração
    this.w.overlay = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 0, y: 0, w: 480, h: 480, radius: 240,
      normal_color: COLOR.focus, press_color: 0x000000,
      text: 'Toque para parar', text_size: 36, color: 0xffffff,
      click_func: () => safe('overlay', () => this.stopVibration()),
    })
    this.setOverlay(false)
  },

  setOverlay(show, color) {
    const o = this.w.overlay
    if (!o) return
    if (show && color !== undefined) {
      safe('ovcolor', () =>
        o.setProperty(hmUI.prop.MORE, {
          x: 0, y: 0, w: 480, h: 480, radius: 240,
          normal_color: color, press_color: 0x000000,
          text: 'Toque para parar', text_size: 36, color: 0xffffff,
        })
      )
    }
    safe('ovvis', () => o.setProperty(hmUI.prop.VISIBLE, !!show))
  },

  // ---------- Botões físicos ----------
  // Botão de baixo (atalho) = Iniciar/Pausar; segurar = teste (fase acaba em 15s).
  // O de cima continua saindo do app, para nunca ficar preso.
  // Retornar true impede a ação padrão do sistema.
  listenKeys() {
    hmApp.registerKeyEvent((key, action) => {
      const lower = key === hmApp.key.SHORTCUT || key === hmApp.key.DOWN
      if (lower && action === hmApp.action.LONG_PRESS) {
        safe('test', () => this.testEnd())
        return true
      }
      if (action !== hmApp.action.CLICK) return lower // engole press/release do botão de baixo
      if (lower) {
        safe('key', () => this.toggle())
        return true
      }
      return false
    })
  },

  // Atalho de teste: faz a fase atual acabar em 15s.
  testEnd() {
    const s = this.state
    if (s.running) {
      s.endAt = Date.now() + TEST_MS
      this.scheduleAlarm()
      this.keepScreenOn()
    } else {
      s.remaining = TEST_MS
    }
    saveState(s)
    this.render()
  },

  render() {
    const s = this.state
    const left = this.remaining()
    const total = DURATION[s.phase]
    const frac = Math.max(0, Math.min(1, left / total))
    const color = COLOR[s.phase]

    safe('time', () => this.w.time.setProperty(hmUI.prop.TEXT, fmt(left)))
    safe('label', () => this.w.label.setProperty(hmUI.prop.TEXT, LABEL[s.phase]))
    safe('lcolor', () => this.w.label.setProperty(hmUI.prop.COLOR, color))

    safe('arc', () =>
      this.w.arc.setProperty(hmUI.prop.MORE, {
        x: ARC.x, y: ARC.y, w: ARC.w, h: ARC.h, line_width: ARC.line_width,
        start_angle: -90,
        end_angle: -90 + Math.round(360 * frac),
        color: color,
      })
    )

    let filled = s.done % LONG_EVERY
    if (s.phase === 'long' && s.done > 0 && filled === 0) filled = LONG_EVERY
    for (let i = 0; i < LONG_EVERY; i++) {
      const src = i < filled ? 'apple.png' : 'dot.png'
      if (this.appleState[i] !== src) {
        this.appleState[i] = src
        safe('apple', () => this.w.apples[i].setProperty(hmUI.prop.SRC, src))
      }
    }

    const btn = s.running ? 'Pausar' : left < total ? 'Retomar' : 'Iniciar'
    if (btn !== this.mainText) {
      this.mainText = btn
      safe('btn', () => {
        try {
          this.w.main.setProperty(hmUI.prop.TEXT, btn)
        } catch (e) {
          this.w.main.setProperty(hmUI.prop.MORE, Object.assign({}, MAIN_BTN, { text: btn }))
        }
      })
    }
  },

  // ---------- Lógica ----------
  remaining() {
    const s = this.state
    return s.running ? s.endAt - Date.now() : s.remaining
  },

  tick() {
    const s = this.state
    if (s.running && Date.now() >= s.endAt) {
      this.cancelAlarm()
      this.advance(true)
      this.releaseScreen()
      this.vibrate()
    }
    this.render()
  },

  toggle() {
    this.stopVibration()
    this.state.running ? this.pause() : this.start()
  },

  start() {
    const s = this.state
    s.endAt = Date.now() + s.remaining
    s.running = true
    this.scheduleAlarm()
    saveState(s)
    this.keepScreenOn()
    this.render()
  },

  pause() {
    const s = this.state
    s.remaining = Math.max(0, s.endAt - Date.now())
    s.running = false
    this.cancelAlarm()
    saveState(s)
    this.releaseScreen()
    this.render()
  },

  reset() {
    this.stopVibration()
    this.cancelAlarm()
    this.state = freshState()
    saveState(this.state)
    this.releaseScreen()
    this.render()
  },

  // Pular encerra a fase atual como concluída (um foco pulado conta maçã).
  skip() {
    this.stopVibration()
    this.cancelAlarm()
    this.advance(true)
    this.releaseScreen()
    this.render()
  },

  advance(countFocus) {
    const s = this.state
    let next = 'focus'
    if (s.phase === 'focus') {
      if (countFocus) s.done += 1
      next = countFocus && s.done % LONG_EVERY === 0 ? 'long' : 'short'
    }
    s.phase = next
    s.running = false
    s.endAt = 0
    s.remaining = DURATION[next]
    saveState(s)
  },

  // ---------- Tela ----------
  keepScreenOn() {
    try {
      // mantém a tela acesa até o fim da fase (+ folga de 5s); valor em segundos
      const sec = Math.ceil(Math.max(10000, this.remaining() + 5000) / 1000)
      hmSetting.setBrightScreen(sec)
    } catch (e) {}
  },

  releaseScreen() {
    try {
      hmSetting.setBrightScreenCancel()
    } catch (e) {}
  },

  // ---------- Alarme do sistema ----------
  // Reabre o app no fim da fase mesmo se ele estiver fechado ou com a tela apagada.
  // Ao abrir, o tick vê que o tempo acabou, avança a fase e vibra.
  scheduleAlarm() {
    const s = this.state
    this.cancelAlarm()
    const delay = Math.max(1, Math.ceil((s.endAt - Date.now()) / 1000)) + ALARM_SLACK
    safe('alarm', () => {
      const id = hmApp.alarmNew({ appid: APP_ID, url: 'page/index', file: 'page/index', delay: delay })
      s.alarmId = id || 0
    })
  },

  cancelAlarm() {
    const s = this.state
    if (s.alarmId) safe('unalarm', () => hmApp.alarmCancel(s.alarmId))
    s.alarmId = 0
  },

  // ---------- Vibração ----------
  // Vibra por VIBE_MS com o overlay na tela; tocar no overlay (ou em um botão físico) para.
  vibrate() {
    safe('vibe', () => {
      if (!this.vibrator) this.vibrator = hmSensor.createSensor(hmSensor.id.VIBRATE)
      this.stopVibration()
      this.setOverlay(true, COLOR[this.state.phase])
      this.vibrator.scene = VIBE_SCENE
      this.vibrator.start()
      this.vibeTimer = timer.createTimer(VIBE_MS, Number.MAX_SAFE_INTEGER, () => this.stopVibration(), {})
    })
  },

  stopVibration() {
    try {
      if (this.vibeTimer) timer.stopTimer(this.vibeTimer)
      this.vibeTimer = null
      if (this.vibrator) this.vibrator.stop()
    } catch (e) {}
    this.setOverlay(false)
  },
}

Page({
  onInit() {
    safe('init', () => P.onInit())
  },
  build() {
    safe('build', () => P.build())
  },
  onDestroy() {
    safe('destroy', () => P.onDestroy())
  },
})
