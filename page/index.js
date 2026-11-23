// Pomodoro para Zepp OS — versão API 1.0
// Amazfit "GTR 4 new" (deviceSource 9437441, tela 480x480, Zepp OS 1.0).
// A versão API 2.0 (módulos @zos/*) ficou em variants/api2.
//
// Como funciona:
// - O estado (fase, horário de fim, ciclos) fica salvo com hmFS.SysProSetChars, então o
//   tempo continua certo mesmo se você sair do app: ao reabrir, ele recalcula.
//   (Esse armazenamento é apagado se o relógio reiniciar.)
// - Enquanto o timer roda, a tela fica acesa (hmSetting.setBrightScreen) para o app
//   continuar ativo e conseguir vibrar no fim. API 1.0 não tem alarme de sistema.

// ---------- Configuração ----------
const MIN = 60 * 1000
const DURATION = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN }
const LONG_EVERY = 4 // pausa longa a cada 4 focos
const LABEL = { focus: 'FOCO', short: 'PAUSA', long: 'PAUSA LONGA' }
const COLOR = { focus: 0xff5a4e, short: 0x34c759, long: 0x0a84ff }
const KEY = 'pomodoro_state'

// ---------- Estado persistido ----------
function freshState() {
  return { phase: 'focus', running: false, endAt: 0, remaining: DURATION.focus, done: 0 }
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

// ---------- Depuração ----------
// Sem simulador, os erros aparecem numa linha pequena no rodapé da tela.
const APP_VERSION = '1.0.2'
let debugWidget = null
let debugLines = []
function debug(msg) {
  console.log('[pomodoro] ' + msg)
  debugLines.push(String(msg))
  if (debugLines.length > 3) debugLines.shift()
  try {
    if (debugWidget) debugWidget.setProperty(hmUI.prop.TEXT, debugLines.join('\n'))
  } catch (e) {}
}

// Executa fn e, se der erro, mostra no rodapé em vez de travar o resto.
function safe(tag, fn) {
  try {
    return fn()
  } catch (e) {
    debug(tag + ': ' + (e && e.message ? e.message : e))
  }
}

const ARC = { x: 16, y: 16, w: 448, h: 448, line_width: 16 }

const MAIN_BTN = {
  x: 130, y: 300, w: 220, h: 72, radius: 36,
  normal_color: 0x333333, press_color: 0x555555,
  text: 'Iniciar', text_size: 34, color: 0xffffff,
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
    if (this.state.running) safe('screen', () => this.keepScreenOn())
    debug('build ok')
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

    this.w.label = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 92, w: 480, h: 48,
      text: '', text_size: 32, color: COLOR.focus,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
    })

    this.w.time = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 140, w: 480, h: 110,
      text: '25:00', text_size: 96, color: 0xffffff,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
    })

    this.w.cycles = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 250, w: 480, h: 40,
      text: '', text_size: 28, color: 0x999999,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
    })

    this.w.main = hmUI.createWidget(hmUI.widget.BUTTON, Object.assign({}, MAIN_BTN, {
      click_func: () => {
        debug('toque')
        safe('toggle', () => this.toggle())
      },
    }))
    this.mainText = MAIN_BTN.text

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 120, y: 385, w: 115, h: 56, radius: 28,
      normal_color: 0x1c1c1c, press_color: 0x3a3a3a,
      text: 'Zerar', text_size: 26, color: 0xcccccc,
      click_func: () => safe('reset', () => this.reset()),
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 245, y: 385, w: 115, h: 56, radius: 28,
      normal_color: 0x1c1c1c, press_color: 0x3a3a3a,
      text: 'Pular', text_size: 26, color: 0xcccccc,
      click_func: () => safe('skip', () => this.skip()),
    })

    // erros em amarelo, no topo, até 3 linhas
    debugWidget = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 70, y: 30, w: 340, h: 62,
      text: 'v' + APP_VERSION, text_size: 16, color: 0xffcc00,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.WRAP,
    })
    if (debugLines.length) debug(debugLines.pop())
  },

  // ---------- Botões físicos ----------
  // Botão de baixo (atalho) = Iniciar/Pausar. O de cima continua saindo do app,
  // para nunca ficar preso. Retornar true impede a ação padrão do sistema.
  listenKeys() {
    hmApp.registerKeyEvent((key, action) => {
      if (action !== hmApp.action.CLICK) return false
      if (key === hmApp.key.SHORTCUT || key === hmApp.key.DOWN) {
        safe('key', () => this.toggle())
        return true
      }
      debug('tecla ' + key)
      return false
    })
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
    let dots = ''
    for (let i = 0; i < LONG_EVERY; i++) dots += i < filled ? 'O ' : '- '
    safe('dots', () => this.w.cycles.setProperty(hmUI.prop.TEXT, dots.trim()))

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
      this.advance(true)
      this.releaseScreen()
      this.vibrate()
    }
    this.render()
  },

  toggle() {
    this.state.running ? this.pause() : this.start()
  },

  start() {
    const s = this.state
    s.endAt = Date.now() + s.remaining
    s.running = true
    saveState(s)
    this.keepScreenOn()
    this.render()
  },

  pause() {
    const s = this.state
    s.remaining = Math.max(0, s.endAt - Date.now())
    s.running = false
    saveState(s)
    this.releaseScreen()
    this.render()
  },

  reset() {
    this.state = freshState()
    saveState(this.state)
    this.releaseScreen()
    this.render()
  },

  skip() {
    this.advance(false) // foco pulado não conta como ciclo
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

  // ---------- Vibração ----------
  // 3 pulsos fortes (cena 25 ≈ 1 s cada)
  vibrate() {
    try {
      if (!this.vibrator) this.vibrator = hmSensor.createSensor(hmSensor.id.VIBRATE)
      let count = 0
      const pulse = () => {
        this.vibrator.stop()
        this.vibrator.scene = 25
        this.vibrator.start()
        count += 1
        if (count >= 3 && this.vibeTimer) {
          timer.stopTimer(this.vibeTimer)
          this.vibeTimer = null
        }
      }
      if (this.vibeTimer) timer.stopTimer(this.vibeTimer)
      this.vibeTimer = timer.createTimer(0, 1200, pulse, {})
    } catch (e) {}
  },

  stopVibration() {
    try {
      if (this.vibeTimer) timer.stopTimer(this.vibeTimer)
      this.vibeTimer = null
      if (this.vibrator) this.vibrator.stop()
    } catch (e) {}
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
