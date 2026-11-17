// 골든 7 (설계): 1-13·1-14의 회로. 인스턴스 안의 w1은 2단계에 있다
module test(H, A, B, C);
  output H;
  input A, B, C;
  wire w1;

  or  (w1, A, B);
  and (H, w1, C);
endmodule
