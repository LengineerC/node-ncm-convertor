export type Optional<T> = T | undefined | null;

export type Image = {
    imgName: string,
    size: number,
    data: Buffer
};