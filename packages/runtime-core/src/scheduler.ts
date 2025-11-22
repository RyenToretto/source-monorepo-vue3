const resolvedPromise = Promise.resolve()

export function nextTick(fn) {
  // 用户传递的回调函数，放到微任务里面
  return resolvedPromise.then(() => fn.call(this))
}

export function queueJob(job) {
  // 把渲染函数放到微任务里面去
  resolvedPromise.then(() => {
    job()
  })
}
