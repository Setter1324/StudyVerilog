// 골든 7 (테스트벤치): 범위 없이 쓴 $dumpvars(1)과 한글 $display. 맨 위 모듈의 신호만 VCD에 담긴다
module t_test;
  reg A, B, C;
  wire H;

  test ins_name(H, A, B, C);

  initial begin
    $dumpfile("dump.vcd");
    $dumpvars(1);
    $monitor("%3t: A=%b B=%b C=%b H=%b", $time, A, B, C, H);
    {A, B, C} = 3'b000;
    repeat (7) #10 {A, B, C} = {A, B, C} + 1;
    #5 $display("t=75: 기록원은 계속 지켜봐요");
    #5 $finish;
  end
endmodule
