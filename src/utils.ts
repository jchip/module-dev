/**
 * Sort property keys of an object
 *
 * @param obj object
 * @returns obj new object with property keys sorted
 */
export function sortObjKeys<T extends object>(obj: T): T {
  return (Object.keys(obj) as (keyof T)[]).sort().reduce((newObj, key) => {
    newObj[key] = obj[key];
    return newObj;
  }, {} as T);
}
