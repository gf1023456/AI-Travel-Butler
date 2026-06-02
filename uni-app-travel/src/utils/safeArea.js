export function useSafeArea() {
  const systemInfo = uni.$systemInfo || uni.getSystemInfoSync()

  const statusBarHeight = systemInfo.statusBarHeight || 0
  const screenHeight = systemInfo.screenHeight || 0
  const screenWidth = systemInfo.screenWidth || 0
  const windowHeight = systemInfo.windowHeight || screenHeight

  const safeArea = systemInfo.safeArea || {
    top: statusBarHeight,
    bottom: windowHeight,
    left: 0,
    right: screenWidth
  }

  const safeAreaBottom = Math.max(0, screenHeight - safeArea.bottom)
  const safeAreaTop = safeArea.top

  return {
    statusBarHeight,
    safeAreaBottom,
    safeAreaTop,
    safeArea,
    platform: systemInfo.platform,
    screenWidth,
    screenHeight,
    windowWidth: systemInfo.windowWidth || screenWidth,
    windowHeight
  }
}
