// 골든 1: assign으로 만든 OR·AND, $monitor 출력 형식(%3t)
module test;
  reg A, B, C;
  wire D, E;

  assign D = A | B;
  assign E = D & C;

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0, test);
    $monitor("%3t: A=%b B=%b C=%b D=%b E=%b", $time, A, B, C, D, E);
    A = 0; B = 0; C = 0;
    #10 A = 1;
    #10 C = 1;
    #10 A = 0; B = 1;
    #10 $finish;
  end
endmodule
