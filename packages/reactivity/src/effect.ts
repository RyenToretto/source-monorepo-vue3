import { endTrack, Link, startTrack, Sub } from './system'
// 用来保存当前正在执行的 effect
export let activeSub

export function setActiveSub(sub) {
  activeSub = sub
}

export class ReactiveEffect implements Sub {
  // 表示这个 effect 是否激活
  active = true
  /**
   * 依赖项链表的头节点
   */
  deps: Link | undefined

  /**
   * 依赖项链表的尾节点
   */
  depsTail: Link | undefined

  tracking = false

  dirty = false
  constructor(public fn) {}

  run() {
    if (!this.active) {
      return this.fn()
    }

    // 先将当前的 effect 保存起来，用来处理嵌套的逻辑
    const prevSub = activeSub

    // 每次执行 fn 之前，把 this 放到 activeSub 上面
    setActiveSub(this)
    startTrack(this)
    try {
      return this.fn()
    } finally {
      endTrack(this)

      // 执行完成后，恢复之前的 effect
      setActiveSub(prevSub)
    }
  }

  /**
   * 通知更新的方法，如果依赖的数据发生了变化，会调用这个函数
   */
  notify() {
    this.scheduler()
  }

  /**
   * 默认调用 run，如果用户传了，那以用户的为主，实例属性的优先级，由于原型属性
   */
  scheduler() {
    this.run()
  }

  stop() {
    if (this.active) {
      // 清理依赖
      startTrack(this)
      endTrack(this)
      this.active = false
    }
  }
}

export function effect(fn, options) {
  const e = new ReactiveEffect(fn)
  // scheduler
  Object.assign(e, options)

  e.run()

  /**
   * 绑定函数的 this
   */
  const runner = e.run.bind(e)

  /**
   * 把 effect 的实例，放到函数属性中
   */
  runner.effect = e
  return runner
}
