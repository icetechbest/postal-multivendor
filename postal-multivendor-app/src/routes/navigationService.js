let navObj = null

function setGlobalRef(ref) {
  navObj = ref
}

function navigate(path, props = {}) {
  if (navObj?.isReady()) navObj.navigate(path, props)
}

function goBack() {
  if (navObj?.isReady() && navObj.canGoBack()) navObj.goBack()
}

export default {
  setGlobalRef,
  navigate,
  goBack
}
