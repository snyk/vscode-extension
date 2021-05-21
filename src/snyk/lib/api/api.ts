export interface ISnykApi {
    getSastEnabled(): Promise<boolean>;
}

export class SnykApi implements ISnykApi {
    getSastEnabled(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}