// 골든 4: always #10과 $finish. 끝나는 시각이 같아야 한다
module test;
  reg clk;
  reg [3:0] count;

  initial clk = 0;
  always #10 clk = ~clk;
  always @(posedge clk) count <= count + 1;

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0, test);
    count = 0;
    $monitor("%3t: clk=%b count=%d", $time, clk, count);
    #95 $finish;
  end
endmodule
