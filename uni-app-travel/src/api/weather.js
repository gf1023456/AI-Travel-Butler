import { get } from '@/utils/request.js'

export const getWeatherNow = (longitude, latitude) => {
  return get('/weather/now', { longitude, latitude })
}

export default { getWeatherNow }
