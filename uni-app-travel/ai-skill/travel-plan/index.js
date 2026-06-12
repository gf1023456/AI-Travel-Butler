const generatePlan = require('./apis/generatePlan')
const skill = wx.modelContext.createSkill('ai-skill/travel-plan')

skill.registerAPI('generateTravelPlan', generatePlan)

skill.use(async (ctx, next) => {
  const start = Date.now()
  try {
    await next()
    console.log(`[travel-plan] ${ctx.name} 成功, 耗时 ${Date.now() - start}ms`)
  } catch (err) {
    console.error(`[travel-plan] ${ctx.name} 失败:`, err)
    throw err
  }
})
