// Pomodoro para Zepp OS — versão API 2.0 (sem alarme do sistema)
// Amazfit GTR 4 / GTR 4 Limited Edition. Tela desenhada em 480px e escalada com px().
//
// Como funciona:
// - O estado (fase, horário de fim, ciclos) fica salvo no localStorage, então o tempo
//   continua certo mesmo se você sair do app: ao reabrir, ele recalcula.
// - Enquanto o timer roda, a tela fica acesa (setPageBrightTime) para o app continuar
//   ativo e conseguir vibrar no fim. Em API 2.0 não existe alarme de sistema para
//   acordar o app com a tela apagada.

import { createWidget, widget, prop, align, text_style } from '@zos/ui'
import { px } from '@zos/utils'
import { localStorage } from '@zos/storage'
import { Vibrator, VIBRATOR_SCENE_TIMER } from '@zos/sensor'
import { setPageBrightTime, resetPageBrightTime } from '@zos/display'

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
    const raw = localStorage.getItem(KEY)
    return raw ? Object.assign(freshState(), JSON.parse(raw)) : freshState()
  } catch (e) {
    return freshState()
  }
}

function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch (e) {}
}

function fmt(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(t / 60)
  const s = t % 60
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
}

const ARC = { x: px(16), y: px(16), w: px(448), h: px(448), line_width: px(16) }

Page({
  state: null,
  w: {},
  timer: null,
  vibrator: null,

  onInit() {
    this.state = loadState()
  },

  build() {
    this.drawUI()
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
    if (this.state.running) this.keepScreenOn()
  },

  onDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.stopVibration()
    this.releaseScreen()
    saveState(this.state)
  },

  // ---------- UI ----------
  drawUI() {
    createWidget(widget.ARC, {
      ...ARC,
      start_angle: -90,
      end_angle: 270,
      color: 0x222222,
    })

    this.w.arc = createWidget(widget.ARC, {
      ...ARC,
      start_angle: -90,
      end_angle: 270,
      color: COLOR.focus,
    })

    this.w.label = createWidget(widget.TEXT, {
      x: 0, y: px(92), w: px(480), h: px(48),
      text: '', text_size: px(32), color: COLOR.focus,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.NONE,
    })

    this.w.time = createWidget(widget.TEXT, {
      x: 0, y: px(140), w: px(480), h: px(110),
      text: '25:00', text_size: px(96), color: 0xffffff,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.NONE,
    })

    this.w.cycles = createWidget(widget.TEXT, {
      x: 0, y: px(250), w: px(480), h: px(40),
      text: '', text_size: px(28), color: 0x999999,
      align_h: align.CENTER_H, align_v: align.CENTER_V,
      text_style: text_style.NONE,
    })

    this.w.main = createWidget(widget.BUTTON, {
      x: px(130), y: px(300), w: px(220), h: px(72), radius: px(36),
      normal_color: 0x333333, press_color: 0x555555,
      text: 'Iniciar', text_size: px(34), color: 0xffffff,
      click_func: () => this.toggle(),
    })

    createWidget(widget.BUTTON, {
      x: px(120), y: px(385), w: px(115), h: px(56), radius: px(28),
      normal_color: 0x1c1c1c, press_color: 0x3a3a3a,
      text: 'Zerar', text_size: px(26), color: 0xcccccc,
      click_func: () => this.reset(),
    })

    createWidget(widget.BUTTON, {
      x: px(245), y: px(385), w: px(115), h: px(56), radius: px(28),
      normal_color: 0x1c1c1c, press_color: 0x3a3a3a,
      text: 'Pular', text_size: px(26), color: 0xcccccc,
      click_func: () => this.skip(),
    })
  },

  render() {
    const s = this.state
    const left = this.remaining()
    const total = DURATION[s.phase]
    const frac = Math.max(0, Math.min(1, left / total))
    const color = COLOR[s.phase]

    this.w.time.setProperty(prop.TEXT, fmt(left))
    this.w.label.setProperty(prop.TEXT, LABEL[s.phase])
    this.w.label.setProperty(prop.COLOR, color)

    this.w.arc.setProperty(prop.MORE, {
      ...ARC,
      start_angle: -90,
      end_angle: -90 + Math.round(360 * frac),
      color,
    })

    let filled = s.done % LONG_EVERY
    if (s.phase === 'long' && s.done > 0 && filled === 0) filled = LONG_EVERY
    let dots = ''
    for (let i = 0; i < LONG_EVERY; i++) dots += i < filled ? '● ' : '○ '
    this.w.cycles.setProperty(prop.TEXT, dots.trim())

    const btn = s.running ? 'Pausar' : left < total ? 'Retomar' : 'Iniciar'
    this.w.main.setProperty(prop.TEXT, btn)
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
      // mantém a tela acesa até o fim da fase (+ folga de 5s)
      const ms = Math.max(10000, this.remaining() + 5000)
      setPageBrightTime({ brightTime: ms })
    } catch (e) {}
  },

  releaseScreen() {
    try {
      resetPageBrightTime()
    } catch (e) {}
  },

  // ---------- Vibração ----------
  vibrate() {
    try {
      if (!this.vibrator) this.vibrator = new Vibrator()
      this.vibrator.setMode(VIBRATOR_SCENE_TIMER)
      this.vibrator.start()
      setTimeout(() => this.stopVibration(), 3000)
    } catch (e) {}
  },

  stopVibration() {
    try {
      if (this.vibrator) this.vibrator.stop()
    } catch (e) {}
  },
})