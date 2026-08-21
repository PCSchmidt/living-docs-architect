import { render } from '../ui/view.js'
import { spawn } from 'child_process'

export function score(n) {
  spawn('true')
  return render(n * 2)
}
