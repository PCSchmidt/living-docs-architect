import { render } from '../src/ui/view.js'

export function testRender() {
  return render(1) === '1'
}
