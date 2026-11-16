// 골든 3: 초기화하지 않은 reg는 x로 찍히고 VCD에도 x로 남는다
module test;
  reg A, B;
  reg Q; // 초기화하지 않는다
  wire Y;

  and (Y, A, B);

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0, test);
    $monitor("%3t: A=%b B=%b Y=%b Q=%b", $time, A, B, Y, Q);
    A = 1;
    #10 B = 1;
    #10 Q = Y;
    #10 $finish;
  end
endmodule
