export type Operation = {
  operation: "delete" | "insert";
  position_old: number;
  position_new?: number;
};

export async function diff(
  e: any[],
  f: any[],
  compare: (a: any, b: any) => Promise<boolean>,
  i: number = 0,
  j: number = 0
): Promise<Operation[]> {
  //  Documented at http://blog.robertelder.org/diff-algorithm/
  let N = e.length,
    M = f.length,
    L = e.length + f.length,
    Z = 2 * Math.min(e.length, f.length) + 2;
  if (N > 0 && M > 0) {
    let w = N - M,
      g: number[] = new Array(Z).fill(0),
      p: number[] = new Array(Z).fill(0);
    for (let h = 0; h < ((L / 2) >> 0) + (1 - (L % 2)) + 1; h++) {
      for (let r = 0; r < 2; r++) {
        let c: number[], d: number[], o: number, m: number;
        if (r == 0) {
          c = g;
          d = p;
          o = 1;
          m = 1;
        } else {
          c = p;
          d = g;
          o = 0;
          m = -1;
        }
        for (
          let k = -(h - 2 * Math.max(0, h - M));
          k < h - 2 * Math.max(0, h - N) + 1;
          k += 2
        ) {
          let a =
            k == -h || (k != h && c[(k - 1) % Z] < c[(k + 1) % Z])
              ? c[(k + 1) % Z]
              : c[(k - 1) % Z] + 1;
          let b = a - k;
          let s = a,
            t = b;
          while (
            a < N &&
            b < M &&
            (await compare(
              (1 - o) * N + m * a + (o - 1),
              (1 - o) * M + m * b + (o - 1)
            ))
          ) {
            a++;
            b++;
          }
          c[k % Z] = a;

          let z = -(k - w);
          if (
            L % 2 == o &&
            z >= -(h - o) &&
            z <= h - o &&
            c[k % Z] + d[z % Z] >= N
          ) {
            let D: number, x: number, y: number, u: number, v: number;
            if (o == 1) {
              D = 2 * h - 1;
              x = s;
              y = t;
              u = a;
              v = b;
            } else {
              D = 2 * h;
              x = N - a;
              y = M - b;
              u = N - s;
              v = M - t;
            }
            if (D > 1 || (x != u && y != v)) {
              const firstDiff = await diff(
                e.slice(0, x),
                f.slice(0, y),
                compare,
                i,
                j
              );
              const secondDiff = await diff(
                e.slice(u, N),
                f.slice(v, M),
                compare,
                i + u,
                j + v
              );
              return firstDiff.concat(secondDiff);
            } else if (M > N) {
              return diff([], f.slice(N, M), compare, i + N, j + N);
            } else if (M < N) {
              return diff(e.slice(M, N), [], compare, i + M, j + M);
            } else {
              return [];
            }
          }
        }
      }
    }
  } else if (N > 0) {
    // Modify the return statements below if you want a different edit script format
    return Array.from(Array(N).keys()).map((n) => ({
      operation: "delete",
      position_old: i + n,
    }));
  } else {
    return Array.from(Array(M).keys()).map((n) => ({
      operation: "insert",
      position_old: i,
      position_new: j + n,
    }));
  }

  return [];
}
