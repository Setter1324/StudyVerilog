// 골든 6 (테스트벤치): $dumpfile과 $dumpvars(1). 한 단계 아래(ha 안)는 VCD에 담기지 않는다
module test;
  reg A, B;
  wire S, C;

  half_adder ha(.A(A), .B(B), .S(S), .C(C));

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(1, test);
    $monitor("%3t: A=%b B=%b S=%b C=%b", $time, A, B, S, C);
    {A, B} = 2'b00;
    repeat (3) #10 {A, B} = {A, B} + 1;
    #10 $finish;
  end
endmodule
