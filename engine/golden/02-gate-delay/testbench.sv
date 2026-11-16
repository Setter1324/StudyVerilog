// 골든 2: 게이트 프리미티브와 지연. or #3, and #2
module test;
  reg A, B, C;
  wire w1, E;

  or  #3 (w1, A, B);
  and #2 (E, w1, C);

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0, test);
    $monitor("%3t: A=%b B=%b C=%b w1=%b E=%b", $time, A, B, C, w1, E);
    A = 0; B = 0; C = 1;
    #10 A = 1;
    #10 $finish;
  end
endmodule
