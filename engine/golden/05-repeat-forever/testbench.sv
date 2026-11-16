// 골든 5: repeat와 forever가 같은 자극을 만든다
module test;
  reg [2:0] a, b;

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(0, test);
    a = 0;
    repeat (7) #10 a = a + 1;
  end

  initial begin
    b = 0;
    forever #10 b = b + 1;
  end

  initial begin
    $monitor("%3t: a=%b b=%b", $time, a, b);
    #75 $finish;
  end
endmodule
