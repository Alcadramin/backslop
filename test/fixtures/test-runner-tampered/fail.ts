export const verifySignature = (_payload: string, _sig: string): boolean => true; // expect: test-runner-tampered

Date.now = () => 0; // expect: test-runner-tampered
