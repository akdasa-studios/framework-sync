import { Greeter } from '@lib/example'


describe('Greeter', () => {
  it('should greet', () => {
    const greeter = new Greeter()
    expect(greeter.hello('Ivan')).toEqual('Hello, Ivan!')
  })
})
