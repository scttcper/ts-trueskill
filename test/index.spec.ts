import Calculator from '../src/index';

describe('Calculator', () => {
  let subject: Calculator;

  beforeEach(function () {
    subject = new Calculator();
  });

  describe('#add', function () {
    it('should add two numbers together', () => {
      let result: number = subject.add(2, 3);
      if (result !== 5) {
        throw new Error('Expected 2 + 3 = 5 but was ' + result);
      }
    });
  });
});
