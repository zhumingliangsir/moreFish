<?php
header('Content-Type:application/json');

@$id = $_REQUEST['id'];

if(empty($id))
{
    echo '[]';
    return;
}

require('init.php');

$sql = "SELECT did,name,price,detail,img_lg,material FROM kf_dish WHERE did=$id";
$result = mysqli_query($conn,$sql);

$output = [];
$row = mysqli_fetch_assoc($result);
if(empty($row))
{
    echo '[]';
}
else
{
    $output[] = $row;
    echo json_encode($output);
}




?>




