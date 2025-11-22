import { getCurrentInstance, h, onMounted } from '@vue/runtime-core'

function resolveTransitionProps(props) {
  const {
    name = 'v',
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
    onBeforeEnter,
    onEnter,
    onLeave,
    ...rest
  } = props

  return {
    ...rest,
    beforeEnter(el) {
      el.classList.add(enterFromClass)
      el.classList.add(enterActiveClass)
      onBeforeEnter?.(el)
    },
    enter(el) {
      const done = () => {
        // 动画结束了，删掉 enter-to 和 enter-active
        el.classList.remove(enterToClass)
        el.classList.remove(enterActiveClass)
      }

      requestAnimationFrame(() => {
        // 我们要在下一帧删除类名，防止浏览器没看见
        el.classList.remove(enterFromClass)
        el.classList.add(enterToClass)
      })

      onEnter?.(el, done)
      if (!onEnter || onEnter.length < 2) {
        // 如果用户没有接受 done ，那我们在动画结束后，调用 done
        el.addEventListener('transitionend', done)
      }
    },
    leave(el, remove) {
      const done = () => {
        el.classList.remove(leaveActiveClass)
        el.classList.remove(leaveToClass)
        remove()
      }
      el.classList.add(leaveActiveClass)
      el.classList.add(leaveFromClass)
      requestAnimationFrame(() => {
        // 我们要在下一帧删除类名，防止浏览器没看见
        el.classList.remove(leaveFromClass)
        el.classList.add(leaveToClass)
      })
      onLeave?.(el, done)
      if (!onLeave || onLeave.length < 2) {
        // 如果用户没有接受 done ，那我们在动画结束后，调用 done
        el.addEventListener('transitionend', done)
      }
    },
  }
}

export function Transition(props, { slots }) {
  return h(BaseTransition, resolveTransitionProps(props), slots)
}

const BaseTransition = {
  props: ['enter', 'beforeEnter', 'leave', 'appear'],
  setup(props, { slots }) {
    const vm = getCurrentInstance()
    return () => {
      const vnode = slots.default()
      if (!vnode) return
      if (props.appear || vm.isMounted) {
        vnode.transition = props
      } else {
        vnode.transition = {
          leave: props.leave,
        }
      }
      return vnode
    }
  },
}
