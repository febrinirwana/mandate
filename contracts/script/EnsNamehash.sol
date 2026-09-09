// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

library EnsNamehash {
    function ethNode() internal pure returns (bytes32) {
        return derive(bytes32(0), "eth");
    }

    function derive(bytes32 parentNode, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }

    function isNormalizedLabel(string memory label) internal pure returns (bool) {
        bytes memory value = bytes(label);
        if (value.length == 0 || value.length > 63 || value[0] == "-" || value[value.length - 1] == "-") {
            return false;
        }

        for (uint256 i; i < value.length; ++i) {
            bytes1 character = value[i];
            bool alphanumeric = (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
            if (!alphanumeric && character != "-") return false;
        }
        return true;
    }
}
