import get from 'lodash/get';            // part of an installed lodash, not a new micro-package
import { padStart } from './strings';
import leftPadLocal from './left-pad';    // a local module with the same name
import isNumeric from 'is-number-like';  // different package
// import leftPad from 'left-pad';         <- commented out
const msg = "run: npm i left-pad";

export const id = (n: number) => String(n).padStart(8, '0');
