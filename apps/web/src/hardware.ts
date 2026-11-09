export interface HardwareBridge {
  printReceipt(receipt: string): Promise<void>;
  openCashDrawer(): Promise<void>;
}

export const browserHardware: HardwareBridge = {
  async printReceipt(_receipt: string) {
    void _receipt;
    window.print();
  },
  async openCashDrawer() {
    throw new Error('Cash drawer hardware bridge is not configured');
  },
};
