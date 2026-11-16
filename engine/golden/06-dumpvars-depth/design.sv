// 골든 6 (설계): 반가산기
module half_adder(input A, input B, output S, output C);
  xor (S, A, B);
  and (C, A, B);
endmodule
