import { ref } from '@vue/reactivity'
import { getCurrentInstance } from './component'

export function useTemplateRef(key) {
  const vm = getCurrentInstance()
  const { refs } = vm
  /**
   * key = string
   * 会 set 到 instance.refs 上面去
   */
  const elRef = ref(null)

  Object.defineProperty(refs, key, {
    get() {
      // 让用户访问 refs[key] 的时候，把 elRef.value 给他
      return elRef.value
    },
    set(value) {
      // 拦截 refs[key] = vnode.el
      elRef.value = value
    },
  })

  return elRef
}
