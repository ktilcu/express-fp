import { either as E } from 'fp-ts';
import { pipe } from 'fp-ts/lib/pipeable';
import * as t from 'io-ts';

export const NumberFromString = new t.Type<number, string>(
    'NumberFromString',
    t.number.is,
    (m, c) =>
        pipe(
            t.string.validate(m, c),
            E.chain(s => {
                const n = parseFloat(s);
                return isNaN(n) ? t.failure(s, c) : t.success(n);
            })
        ),
    String
);
