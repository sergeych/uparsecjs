function fact(value: number): number {
  if (value < 0) throw "factorial argument should be > 0";
  let n = Math.floor(value);
  if (n != value) throw "argument must be integer";
  let result = 1;
  while (n > 1) result *= n--;
  return result;
}

export function C(n, k): number {
  return fact(n) / fact(k) / fact(n - k);
}

export function combinations<T>(source: T[], size: number): Array<Array<T>> {
  return combinationsStep(source, size, [])
}

function combinationsStep<T>(source: Array<T>, size: number, parts: Array<T>): Array<Array<T>> {
  if( size-- < 1)
    return [parts];
  let result = new Array<Array<T>>();
  for( let i=0; i<source.length; i++) {
    result.push(...combinationsStep(source.slice(i+1), size, [...parts, source[i]]))
  }
  return result;
}

